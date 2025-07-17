package main

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"

	"github.com/vitwit/healthlock/tee-client/cmd"
)

const (
	PROGRAM_ID                = "8X7bEsKtuLqRcEM7s7RJ9wiCwdbdQ56yZQapYX5vVfjV"
	ANCHOR_DISCRIMINATOR_SIZE = 8
)

// Program ID
var programID = solana.MustPublicKeyFromBase58(PROGRAM_ID)

// calculateDiscriminator generates the 8-byte discriminator for Anchor instructions
func calculateDiscriminator(name string) []byte {
	hash := sha256.Sum256([]byte(name))
	return hash[:8]
}

type RecordCounter struct {
	RecordId uint64 `borsh:"record_id"`
}

// TEEState represents the TEE node state structure
type TEEState struct {
	Signer        solana.PublicKey `borsh:"signer"`
	Pubkey        []byte           `borsh:"pubkey"`
	Attestation   []byte           `borsh:"attestation"`
	IsInitialized bool             `borsh:"is_initialized"`
}

// HealthLockClient represents the client for interacting with the HealthLock program
type HealthLockClient struct {
	rpcClient *rpc.Client
	wsClient  *ws.Client
	wallet    solana.PrivateKey
	programID solana.PublicKey
}

// NewHealthLockClient creates a new HealthLock client
func NewHealthLockClient(rpcURL, wsURL string, privateKey solana.PrivateKey) (*HealthLockClient, error) {
	rpcClient := rpc.New(rpcURL)
	wsClient, err := ws.Connect(context.Background(), wsURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to websocket: %w", err)
	}

	return &HealthLockClient{
		rpcClient: rpcClient,
		wsClient:  wsClient,
		wallet:    privateKey,
		programID: programID,
	}, nil
}

// Close closes the WebSocket connection
func (c *HealthLockClient) Close() {
	if c.wsClient != nil {
		c.wsClient.Close()
	}
}

// derive PDA with bump
func (c *HealthLockClient) findProgramAddress(seeds [][]byte) (solana.PublicKey, uint8, error) {
	return solana.FindProgramAddress(seeds, c.programID)
}

// GetWalletPublicKey returns the wallet's public key
func (c *HealthLockClient) GetWalletPublicKey() solana.PublicKey {
	return c.wallet.PublicKey()
}

// CheckProgramExists checks if the program exists on the network
func (c *HealthLockClient) CheckProgramExists() error {
	ctx := context.Background()
	accountInfo, err := c.rpcClient.GetAccountInfo(ctx, c.programID)
	if err != nil {
		return fmt.Errorf("failed to get program account info: %w", err)
	}

	if accountInfo.Value == nil {
		return fmt.Errorf("program account not found")
	}

	fmt.Printf("Program found! Owner: %s\n", accountInfo.Value.Owner)
	return nil
}

// RegisterTEENode registers a new TEE node with the given public key and attestation
func (c *HealthLockClient) RegisterTEENode(pubkey, attestation []byte) (*solana.Signature, error) {
	statePDA, _, err := c.findProgramAddress([][]byte{
		[]byte("state"),
		c.wallet.PublicKey().Bytes(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to derive state PDA: %w", err)
	}

	instructionData := make([]byte, 0)

	discriminator := calculateDiscriminator("global:register_tee")

	instructionData = append(instructionData, discriminator...)

	pubkeyLen := make([]byte, 4)
	binary.LittleEndian.PutUint32(pubkeyLen, uint32(len(pubkey)))
	instructionData = append(instructionData, pubkeyLen...)
	instructionData = append(instructionData, pubkey...)

	attestationLen := make([]byte, 4)
	binary.LittleEndian.PutUint32(attestationLen, uint32(len(attestation)))
	instructionData = append(instructionData, attestationLen...)
	instructionData = append(instructionData, attestation...)

	accounts := []*solana.AccountMeta{
		{PublicKey: statePDA, IsSigner: false, IsWritable: true},
		{PublicKey: c.wallet.PublicKey(), IsSigner: true, IsWritable: true},
		{PublicKey: solana.SystemProgramID, IsSigner: false, IsWritable: false},
	}

	instruction := &solana.GenericInstruction{
		ProgID:        c.programID,
		AccountValues: accounts,
		DataBytes:     instructionData,
	}

	return c.sendTransaction([]*solana.GenericInstruction{instruction})
}

// GetTEEState retrieves the TEE state for the current signer
func (c *HealthLockClient) GetTEEState() (*TEEState, error) {
	statePDA, _, err := c.findProgramAddress([][]byte{
		[]byte("state"),
		c.wallet.PublicKey().Bytes(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to derive state PDA: %w", err)
	}

	ctx := context.Background()
	accountInfo, err := c.rpcClient.GetAccountInfo(ctx, statePDA)
	if err != nil {
		return nil, fmt.Errorf("failed to get TEE state account info: %w", err)
	}

	if accountInfo.Value == nil {
		return nil, fmt.Errorf("TEE state account not found (needs to be registered)")
	}

	data := accountInfo.Value.Data.GetBinary()
	if len(data) < ANCHOR_DISCRIMINATOR_SIZE {
		return nil, fmt.Errorf("account data too short")
	}

	stateData := data[ANCHOR_DISCRIMINATOR_SIZE:]

	if len(stateData) < 32 {
		return nil, fmt.Errorf("insufficient data for TEE state")
	}

	state := &TEEState{}

	copy(state.Signer[:], stateData[0:32])
	offset := 32

	if len(stateData) < offset+4 {
		return nil, fmt.Errorf("insufficient data for pubkey length")
	}
	pubkeyLen := binary.LittleEndian.Uint32(stateData[offset : offset+4])
	offset += 4

	if len(stateData) < offset+int(pubkeyLen) {
		return nil, fmt.Errorf("insufficient data for pubkey")
	}
	state.Pubkey = make([]byte, pubkeyLen)
	copy(state.Pubkey, stateData[offset:offset+int(pubkeyLen)])
	offset += int(pubkeyLen)

	if len(stateData) < offset+4 {
		return nil, fmt.Errorf("insufficient data for attestation length")
	}
	attestationLen := binary.LittleEndian.Uint32(stateData[offset : offset+4])
	offset += 4

	if len(stateData) < offset+int(attestationLen) {
		return nil, fmt.Errorf("insufficient data for attestation")
	}
	state.Attestation = make([]byte, attestationLen)
	copy(state.Attestation, stateData[offset:offset+int(attestationLen)])
	offset += int(attestationLen)

	if len(stateData) < offset+1 {
		return nil, fmt.Errorf("insufficient data for is_initialized")
	}
	state.IsInitialized = stateData[offset] != 0

	return state, nil
}

// sendTransaction sends a transaction to the network
func (c *HealthLockClient) sendTransaction(instructions []*solana.GenericInstruction) (*solana.Signature, error) {
	recent, err := c.rpcClient.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent blockhash: %w", err)
	}

	var solanaInstructions []solana.Instruction
	for _, inst := range instructions {
		solanaInstructions = append(solanaInstructions, inst)
	}

	tx, err := solana.NewTransaction(
		solanaInstructions,
		recent.Value.Blockhash,
		solana.TransactionPayer(c.wallet.PublicKey()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	_, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(c.wallet.PublicKey()) {
			return &c.wallet
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	sig, err := c.rpcClient.SendTransaction(context.Background(), tx)
	if err != nil {
		return nil, fmt.Errorf("failed to send transaction: %w", err)
	}

	return &sig, nil
}

// confirmation method using GetTransaction
func (c *HealthLockClient) WaitForConfirmation(sig solana.Signature) error {
	ctx := context.Background()
	maxRetries := 30
	retryDelay := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		if i > 0 {
			time.Sleep(retryDelay)
		}

		tx, err := c.rpcClient.GetTransaction(ctx, sig, &rpc.GetTransactionOpts{
			Commitment: rpc.CommitmentFinalized,
		})
		if err != nil {
			fmt.Printf("Attempt %d: Failed to get transaction: %v\n", i+1, err)
			continue
		}

		if tx == nil {
			fmt.Printf("Attempt %d: Transaction not found, retrying...\n", i+1)
			continue
		}

		if tx.Meta.Err != nil {
			return fmt.Errorf("transaction failed: %v", tx.Meta.Err)
		}

		fmt.Printf("Transaction confirmed successfully!\n")
		return nil
	}

	return fmt.Errorf("transaction confirmation timeout after %d attempts", maxRetries)
}

func main() {
	// 	rpcURL := "http://localhost:8899"
	// 	wsURL := "ws://localhost:8900"

	// 	account := solana.NewWallet()
	// 	fmt.Println("Account private key:", account.PrivateKey)
	// 	fmt.Println("Account public key:", account.PublicKey())

	// 	rpcClient := rpc.New(rpcURL)

	// 	fmt.Println("\n=== Requesting Initial Airdrop ===")
	// 	out, err := rpcClient.RequestAirdrop(
	// 		context.TODO(),
	// 		account.PublicKey(),
	// 		solana.LAMPORTS_PER_SOL*1,
	// 		rpc.CommitmentFinalized,
	// 	)
	// 	if err != nil {
	// 		panic(err)
	// 	}
	// 	fmt.Println("Initial airdrop transaction signature:", out)

	// 	time.Sleep(time.Second * 20)

	// 	client, err := NewHealthLockClient(rpcURL, wsURL, account.PrivateKey)
	// 	if err != nil {
	// 		log.Fatalf("Failed to create client: %v", err)
	// 	}
	// 	defer client.Close()

	// 	balance, err := client.rpcClient.GetBalance(context.Background(), client.wallet.PublicKey(), rpc.CommitmentFinalized)
	// 	if err != nil {
	// 		log.Printf("Failed to get balance: %v", err)
	// 	} else {
	// 		fmt.Printf("Wallet balance: %d lamports (%.2f SOL)\n", balance.Value, float64(balance.Value)/1e9)
	// 	}

	// 	fmt.Println("\n=== Testing Program Existence ===")
	// 	if err := client.CheckProgramExists(); err != nil {
	// 		log.Fatalf("Program check failed: %v", err)
	// 	}

	// 	apiServer := NewApiServer(client)
	// 	mux := RegisterHandler(apiServer)
	// 	addr := ":8080"
	// 	fmt.Printf("API Server listening on %s\n", addr)
	// 	log.Fatal(http.ListenAndServe(addr, mux))
	// }

	// func RegisterHandler(apiServer *ApiServer) http.Handler {
	// 	mux := http.NewServeMux()
	// 	mux.HandleFunc("/tee/state", apiServer.GetTEEState)
	// 	mux.HandleFunc("/tee/register", apiServer.RegisterTEENode)
	// 	return mux
	// }

	// // --- API Server Section ---

	// type ApiServer struct {
	// 	client *HealthLockClient
	// }

	// func NewApiServer(hlClient *HealthLockClient) *ApiServer {
	// 	return &ApiServer{client: hlClient}
	// }

	// // Updated handler (handle GET, add content-type)
	// func (api *ApiServer) GetTEEState(w http.ResponseWriter, r *http.Request) {
	// 	if r.Method != http.MethodGet { // Enforce GET
	// 		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	// 		return
	// 	}
	// 	state, err := api.client.GetTEEState()
	// 	if err != nil {
	// 		http.Error(w, fmt.Sprintf("Failed to get TEE state: %v", err), http.StatusInternalServerError)
	// 		return
	// 	}
	// 	w.Header().Set("Content-Type", "application/json")
	// 	w.WriteHeader(http.StatusOK)
	// 	json.NewEncoder(w).Encode(state)
	// }

	// func (api *ApiServer) RegisterTEENode(w http.ResponseWriter, r *http.Request) {
	// 	type Request struct {
	// 		PubKey      string `json:"pubkey"`      // base58 or hex
	// 		Attestation string `json:"attestation"` // base64
	// 	}

	// 	var req Request
	// 	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
	// 		http.Error(w, "invalid JSON body", http.StatusBadRequest)
	// 		return
	// 	}

	// 	// Decode inputs
	// 	pubkey, err := base64.StdEncoding.DecodeString(req.PubKey)
	// 	if err != nil {
	// 		http.Error(w, "invalid pubkey format", http.StatusBadRequest)
	// 		return
	// 	}

	// 	attestation, err := base64.StdEncoding.DecodeString(req.Attestation)
	// 	if err != nil {
	// 		http.Error(w, "invalid attestation format", http.StatusBadRequest)
	// 		return
	// 	}

	// 	// Call on-chain registration logic
	// 	sig, err := api.client.RegisterTEENode(pubkey, attestation)
	// 	if err != nil {
	// 		http.Error(w, fmt.Sprintf("failed to register TEE node: %v", err), http.StatusInternalServerError)
	// 		return
	// 	}

	// // Return success
	// resp := map[string]string{"signature": sig.String()}
	// w.Header().Set("Content-Type", "application/json")
	// json.NewEncoder(w).Encode(resp)

	// config, err := config.LoadConfig("example.config.toml")
	// if err != nil {
	// 	log.Fatalf("Error loading config: %v", err)
	// }

	// fmt.Println("Solana RPC:", config.Solana.RPC)
	// fmt.Println("Solana WebSocket:", config.Solana.WebSocket)
	// fmt.Println("Solana Program ID:", config.Solana.ProgramID)
	// fmt.Println("REST Port:", config.Rest.Port)

	cmd.Execute()

}
