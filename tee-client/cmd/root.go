package cmd

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/spf13/cobra"
	"github.com/vitwit/healthlock/tee-client/config"
	"github.com/vitwit/healthlock/tee-client/keys"
	"github.com/vitwit/healthlock/tee-client/solana"
	"github.com/vitwit/healthlock/tee-client/tee"
	"github.com/vitwit/healthlock/tee-client/types"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

var (
	cfgPath string

	debug bool

	rootCmd = &cobra.Command{
		Use:   "start",
		Short: "Start the service with the specified config file",
		Run:   runStart,
	}
)

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println("Error:", err)
		os.Exit(1)
	}

}

func init() {
	rootCmd.Flags().StringVar(&cfgPath, "config", "", "Path to config.toml")
	rootCmd.MarkFlagRequired("config")

	rootCmd.Flags().BoolVar(&debug, "debug", false, "Enable debug mode")
}

func runStart(cmd *cobra.Command, args []string) {
	config, err := config.LoadConfig(cfgPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	printConfigPretty(config)

	ctx := types.NewContext()
	ctx = ctx.WithConfig(config)

	// generate keys
	keyPairs, err := keys.GenerateKeyPair(2048, debug)
	if err != nil {
		log.Fatal(err)
	}

	ctx = ctx.WithKeyPairs(keyPairs)

	// connect to solana client
	solanaClient, err := solana.NewClient(ctx)
	if err != nil {
		log.Fatal(err)
	}

	if err := solanaClient.CheckProgramExists(ctx); err != nil {
		log.Fatal(err)
	}

	if err := solanaClient.CreateWallet(debug); err != nil {
		log.Fatal(err)
	}

	if config.Solana.NetworkType != "mainnet" {
		fmt.Println("\n=== Requesting Initial Airdrop ===")
		out, err := solanaClient.RPC().RequestAirdrop(
			context.TODO(),
			solanaClient.GetPubKey(),
			solanago.LAMPORTS_PER_SOL*1,
			rpc.CommitmentFinalized,
		)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("Initial airdrop transaction signature:", out)

		time.Sleep(time.Second * 20)
	}

	// make sure that TEE hardware
	attestor, err := tee.NewAttestor()
	if err != nil {
		log.Fatal(err)
	}

	pubKeyBase64, err := keyPairs.ExportPublicKeyBase64()
	if err != nil {
		log.Fatal(err)
	}

	nonce, err := tee.BuildAttestationNonce(solanaClient.GetPubKeyString(), pubKeyBase64)
	if err != nil {
		log.Fatal(err)
	}

	report, err := attestor.GenerateAttestationReport(nonce)
	if err != nil {
		log.Fatal(err)
	}

	signature, err := solanaClient.RegisterTEENode(*ctx, []byte(pubKeyBase64), report)
	if err != nil {
		if debug {
			fmt.Println(err)
		} else {
			log.Fatal(err)
		}
	}

	fmt.Println(signature)

	startRESTServer(ctx, config, solanaClient, keyPairs)

}

func printConfigPretty(config *config.Config) {
	fmt.Println("********************")
	fmt.Printf("Solana RPC: %s\n", config.Solana.RPC)
	fmt.Printf("Solana WebSocket: %s\n", config.Solana.WebSocket)
	fmt.Printf("Solana Program ID: %s\n", config.Solana.ProgramID)
	fmt.Printf("REST Port: %d\n", config.Rest.Port)
	fmt.Println("********************")
}

func startRESTServer(ctx *types.Context, cfg *config.Config, solClient *solana.Client, keyPairs *keys.KeyPair) {
	http.HandleFunc("/download-record", DecryptAndServeHandler(*ctx, solClient, keyPairs))
	http.HandleFunc("/upload-record", UploadRecordHandler(*ctx, solClient, keyPairs))

	addr := ":" + strconv.Itoa(cfg.Rest.Port)
	fmt.Printf("Starting REST server at http://localhost%s\n", ":8085")
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Failed to start REST server: %v", err)
	}
}

type DecryptRequest struct {
	CID         string `json:"cid"`       // IPFS CID of the encrypted JSON file
	Signer      string `json:"signer"`    // Who is requesting
	Signature   string `json:"signature"` // Signed message
	RecordOwner string `json:"recordOwner"`
	RecordID    uint64 `json:"recordId"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type FrontendEncryptedPayload struct {
	EncryptedAESKey string `json:"encrypted_aes_key"`
	Ciphertext      string `json:"ciphertext"`
	Nonce           string `json:"nonce"`
}

func writeJSONError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: msg})
}

// detectFileType analyzes the first few bytes to determine file type
func detectFileType(data []byte) string {
	if len(data) < 8 {
		return "unknown"
	}

	// PDF signature: %PDF
	if len(data) >= 4 && data[0] == 0x25 && data[1] == 0x50 && data[2] == 0x44 && data[3] == 0x46 {
		return "pdf"
	}

	// JPEG signatures: FF D8 FF
	if len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return "jpeg"
	}

	// PNG signature: 89 50 4E 47 0D 0A 1A 0A
	if len(data) >= 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 &&
		data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A {
		return "png"
	}

	// GIF signatures: GIF87a or GIF89a
	if len(data) >= 6 && data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
		return "gif"
	}

	// Default fallback
	return "unknown"
}

func DecryptAndServeHandler(ctx types.Context, solClient *solana.Client, keypair *keys.KeyPair) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("📩 Request incoming")

		if r.Method != http.MethodPost {
			writeJSONError(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req DecryptRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Validate required fields
		if req.CID == "" {
			writeJSONError(w, "CID is required", http.StatusBadRequest)
			return
		}

		// Parse pubkeys
		recordOwnerPubkey, err := solanago.PublicKeyFromBase58(req.RecordOwner)
		if err != nil {
			writeJSONError(w, "Invalid record_owner pubkey", http.StatusBadRequest)
			return
		}
		signerPubkey, err := solanago.PublicKeyFromBase58(req.Signer)
		if err != nil {
			writeJSONError(w, "Invalid signer pubkey", http.StatusBadRequest)
			return
		}

		// Construct and verify signature
		message := fmt.Sprintf("record-access:%s:%s:%d", req.Signer, req.RecordOwner, req.RecordID)
		sig, err := solanago.SignatureFromBase58(req.Signature)
		if err != nil {
			writeJSONError(w, "Invalid signature", http.StatusBadRequest)
			return
		}
		if !sig.Verify(signerPubkey, []byte(message)) {
			writeJSONError(w, "Signature verification failed", http.StatusUnauthorized)
			return
		}

		// Read from Solana
		record, err := solClient.ReadHealthRecord(ctx, recordOwnerPubkey, req.RecordID)
		if err != nil {
			writeJSONError(w, "Failed to fetch health record", http.StatusInternalServerError)
			return
		}

		if !record.Owner.Equals(recordOwnerPubkey) {
			authorized := false
			for i := 0; i < len(record.AccessList); i++ {
				if record.AccessList[i].Organization.Equals(signerPubkey) {
					authorized = true
					break
				}
			}

			if !authorized {
				writeJSONError(w, "Not authorized to view this document", http.StatusUnauthorized)
				return
			}
		}

		ipfsData, err := DownloadJsonFromPinata(req.CID)
		if err != nil {
			fmt.Printf("❌ Failed to fetch from IPFS: %v\n", err)
			writeJSONError(w, "Failed to fetch file from IPFS", http.StatusBadGateway)
			return
		}

		fmt.Printf("📦 Fetched %d bytes from IPFS\n", len(ipfsData))

		// 🔓 Parse encrypted payload (matches your frontend format)
		var enc FrontendEncryptedPayload
		if err := json.Unmarshal(ipfsData, &enc); err != nil {
			fmt.Printf("❌ Failed to parse encrypted payload: %v\n", err)
			writeJSONError(w, "Invalid encrypted payload format", http.StatusBadRequest)
			return
		}

		// Validate required fields in encrypted payload
		if enc.EncryptedAESKey == "" || enc.Ciphertext == "" || enc.Nonce == "" {
			writeJSONError(w, "Missing required fields in encrypted payload", http.StatusBadRequest)
			return
		}

		// 🔓 Decode base64 values
		encryptedAESKey, err := base64.StdEncoding.DecodeString(enc.EncryptedAESKey)
		if err != nil {
			fmt.Printf("❌ Failed to decode encrypted AES key: %v\n", err)
			writeJSONError(w, "Invalid base64: Encrypted AES key", http.StatusBadRequest)
			return
		}

		ciphertext, err := base64.StdEncoding.DecodeString(enc.Ciphertext)
		if err != nil {
			fmt.Printf("❌ Failed to decode ciphertext: %v\n", err)
			writeJSONError(w, "Invalid base64: Ciphertext", http.StatusBadRequest)
			return
		}

		nonce, err := base64.StdEncoding.DecodeString(enc.Nonce)
		if err != nil {
			fmt.Printf("❌ Failed to decode nonce: %v\n", err)
			writeJSONError(w, "Invalid base64: Nonce", http.StatusBadRequest)
			return
		}

		// Validate nonce length (AES-GCM standard is 12 bytes)
		if len(nonce) != 12 {
			fmt.Printf("❌ Invalid nonce length: got %d, expected 12\n", len(nonce))
			writeJSONError(w, "Invalid nonce length (expected 12 bytes)", http.StatusBadRequest)
			return
		}

		fmt.Printf("🔑 Decrypting AES key with RSA (key size: %d bytes)\n", len(encryptedAESKey))

		// 🔐 Decrypt AES key with RSA OAEP (SHA-256) - matches your Android code
		aesKey, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, keypair.PrivateKey, encryptedAESKey, nil)
		if err != nil {
			fmt.Printf("❌ Failed to decrypt AES key: %v\n", err)
			writeJSONError(w, "Failed to decrypt AES key", http.StatusUnauthorized)
			return
		}

		fmt.Printf("🔓 AES key decrypted successfully (key length: %d bytes)\n", len(aesKey))

		// 🔐 Decrypt ciphertext with AES-GCM
		block, err := aes.NewCipher(aesKey)
		if err != nil {
			fmt.Printf("❌ Failed to create AES cipher: %v\n", err)
			writeJSONError(w, "AES cipher init failed", http.StatusInternalServerError)
			return
		}

		aesgcm, err := cipher.NewGCM(block)
		if err != nil {
			fmt.Printf("❌ Failed to create AES-GCM: %v\n", err)
			writeJSONError(w, "AES-GCM init failed", http.StatusInternalServerError)
			return
		}

		fmt.Printf("🔓 Decrypting %d bytes of ciphertext\n", len(ciphertext))

		plaintext, err := aesgcm.Open(nil, nonce, ciphertext, nil)
		if err != nil {
			fmt.Printf("❌ AES decryption failed: %v\n", err)
			writeJSONError(w, "AES decryption failed - invalid data or key", http.StatusUnauthorized)
			return
		}

		fmt.Printf("✅ Successfully decrypted %d bytes of data\n", len(plaintext))

		// ✅ Detect file type from decrypted content for better client handling
		fileType := detectFileType(plaintext)

		// ✅ Serve decrypted data as base64 for React Native compatibility
		base64Data := base64.StdEncoding.EncodeToString(plaintext)

		// Set headers to indicate this is base64-encoded binary data with file type info
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=\"decrypted_file\"")
		w.Header().Set("Content-Length", strconv.Itoa(len(base64Data)))
		w.Header().Set("X-Original-Size", strconv.Itoa(len(plaintext)))
		w.Header().Set("X-Detected-File-Type", fileType)
		w.WriteHeader(http.StatusOK)

		bytesWritten, err := w.Write([]byte(base64Data))
		if err != nil {
			fmt.Printf("❌ Failed to write response: %v\n", err)
			return
		}

		fmt.Printf("📤 Successfully served %d bytes (base64) to client, original size: %d bytes\n", bytesWritten, len(plaintext))
	}
}

func UploadRecordHandler(ctx types.Context, solClient *solana.Client, keypair *keys.KeyPair) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		// Limit upload size to 5MB
		r.Body = http.MaxBytesReader(w, r.Body, 5<<20) // 5MB

		// Parse multipart form (up to 5MB)
		err := r.ParseMultipartForm(5 << 20)
		if err != nil {
			writeJSONError(w, "File too large or malformed form", http.StatusBadRequest)
			return
		}

		signer := r.FormValue("signer")
		if signer == "" {
			writeJSONError(w, "Missing signer address", http.StatusBadRequest)
			return
		}

		signerPubkey, err := solanago.PublicKeyFromBase58(signer)
		if err != nil {
			writeJSONError(w, "Invalid signer pubkey", http.StatusBadRequest)
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			writeJSONError(w, "Missing file", http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Read file and compute SHA-256 checksum
		fileBytes, err := io.ReadAll(file)
		if err != nil {
			writeJSONError(w, "Failed to read uploaded file", http.StatusInternalServerError)
			return
		}

		checksum := fmt.Sprintf("%x", sha256.Sum256(fileBytes))
		dirPath := filepath.Join("upload", signerPubkey.String())
		filePath := filepath.Join(dirPath, checksum)

		// If file already exists, don't overwrite
		if _, err := os.Stat(filePath); err == nil {
			resp := map[string]string{
				"checksum": checksum,
				"path":     filePath,
				"status":   "already exists",
			}
			writeJSON(w, resp)
			return
		}

		// Ensure directory exists
		if err := os.MkdirAll(dirPath, os.ModePerm); err != nil {
			writeJSONError(w, "Failed to create upload directory", http.StatusInternalServerError)
			return
		}

		// Save file
		if err := os.WriteFile(filePath, fileBytes, 0644); err != nil {
			writeJSONError(w, "Failed to save file", http.StatusInternalServerError)
			return
		}

		// Respond with checksum and storage path
		resp := map[string]string{
			"checksum": checksum,
			"path":     fmt.Sprintf("upload/%s/%s", signerPubkey.String(), checksum),
		}
		writeJSON(w, resp)
	}
}

// writeJSON writes a map or struct as a JSON response
func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(data)
}
