package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gagliardetto/solana-go/rpc"
	"github.com/spf13/cobra"
	"github.com/vitwit/healthlock/tee-client/config"
	"github.com/vitwit/healthlock/tee-client/keys"
	"github.com/vitwit/healthlock/tee-client/solana"
	"github.com/vitwit/healthlock/tee-client/tee"
	"github.com/vitwit/healthlock/tee-client/types"

	solanago "github.com/gagliardetto/solana-go"
)

var (
	cfgPath string
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
	keyPairs, err := keys.GenerateKeyPair(2048)
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

	if err := solanaClient.CreateWallet(); err != nil {
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
		log.Fatal(err)
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

	addr := ":" + strconv.Itoa(cfg.Rest.Port)
	fmt.Printf("Starting REST server at http://localhost%s\n", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Failed to start REST server: %v", err)
	}
}

type DecryptRequest struct {
	RecordOwner string `json:"record_owner"`
	RecordID    uint64 `json:"record_id"`
	Signer      string `json:"signer"`
	Signature   string `json:"signature"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func writeJSONError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(ErrorResponse{Error: msg})
}

func DecryptAndServeHandler(ctx types.Context, solClient *solana.Client, keypair *keys.KeyPair) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req DecryptRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "Invalid JSON", http.StatusBadRequest)
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

		// Decrypt
		plaintext, err := keypair.DecryptBase64Bytes(record.EncryptedData)
		if err != nil {
			writeJSONError(w, "Decryption failed", http.StatusInternalServerError)
			return
		}

		// Serve decrypted content
		w.Header().Set("Content-Type", record.MimeType)
		w.Header().Set("Content-Disposition", "inline")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(plaintext)
	}
}
