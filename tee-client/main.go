package main

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"log"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
)

const (
	PROGRAM_ID                = "5PVKhLRUvDnc9tRAwXRroECjeibeT8oTjD5duYte1nuX"
	ANCHOR_DISCRIMINATOR_SIZE = 8
)

// Program ID
var programID = solana.MustPublicKeyFromBase58(PROGRAM_ID)

// Instruction discriminators - properly calculated for Anchor
var (
	InitializeRecordCounterDiscriminator       = calculateDiscriminator("global:initialize_record_counter")
	RegisterUserDiscriminator                  = calculateDiscriminator("global:register_user")
	InitializeOrganizationCounterDiscriminator = calculateDiscriminator("global:initialize_organization_counter")
	RegisterOrganizationDiscriminator          = calculateDiscriminator("global:register_organization")
	UploadHealthRecordDiscriminator            = calculateDiscriminator("global:upload_health_record")
	GrantAccessDiscriminator                   = calculateDiscriminator("global:grant_access")
	RevokeAccessDiscriminator                  = calculateDiscriminator("global:revoke_access")
	UpdateUserVaultDiscriminator               = calculateDiscriminator("global:update_user_vault")
	DeactivateRecordDiscriminator              = calculateDiscriminator("global:deactivate_record")
)

// calculateDiscriminator generates the 8-byte discriminator for Anchor instructions
func calculateDiscriminator(name string) []byte {
	hash := sha256.Sum256([]byte(name))
	return hash[:8]
}

type RecordCounter struct {
	RecordId uint64 `borsh:"record_id"`
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

// GetRecordCounter gets the current record counter value
func (c *HealthLockClient) GetRecordCounter() (*RecordCounter, error) {
	recordCounterPDA, _, err := c.findProgramAddress([][]byte{[]byte("record_counter")})
	if err != nil {
		return nil, fmt.Errorf("failed to derive record counter PDA: %w", err)
	}

	ctx := context.Background()
	accountInfo, err := c.rpcClient.GetAccountInfo(ctx, recordCounterPDA)
	if err != nil {
		return nil, fmt.Errorf("failed to get record counter account info: %w", err)
	}

	if accountInfo.Value == nil {
		return nil, fmt.Errorf("record counter account not found (needs to be initialized)")
	}

	data := accountInfo.Value.Data.GetBinary()
	if len(data) < 16 {
		return nil, fmt.Errorf("account data too short")
	}

	recordIdBytes := data[8:16]
	recordId := binary.LittleEndian.Uint64(recordIdBytes)

	counter := &RecordCounter{
		RecordId: recordId,
	}

	return counter, nil
}

// InitializeRecordCounter initializes the global record counter
func (c *HealthLockClient) InitializeRecordCounter() (*solana.Signature, error) {
	recordCounterPDA, _, err := c.findProgramAddress([][]byte{[]byte("record_counter")})
	if err != nil {
		return nil, fmt.Errorf("failed to derive record counter PDA: %w", err)
	}

	accounts := []*solana.AccountMeta{
		{PublicKey: recordCounterPDA, IsSigner: false, IsWritable: true},
		{PublicKey: c.wallet.PublicKey(), IsSigner: true, IsWritable: true},
		{PublicKey: solana.SystemProgramID, IsSigner: false, IsWritable: false},
	}

	instruction := &solana.GenericInstruction{
		ProgID:        c.programID,
		AccountValues: accounts,
		DataBytes:     InitializeRecordCounterDiscriminator,
	}

	return c.sendTransaction([]*solana.GenericInstruction{instruction})
}

// sendTransaction sends a transaction to the network
func (c *HealthLockClient) sendTransaction(instructions []*solana.GenericInstruction) (*solana.Signature, error) {
	// Get recent blockhash
	recent, err := c.rpcClient.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent blockhash: %w", err)
	}

	// Convert to solana.Instruction interface
	var solanaInstructions []solana.Instruction
	for _, inst := range instructions {
		solanaInstructions = append(solanaInstructions, inst)
	}

	// Create transaction
	tx, err := solana.NewTransaction(
		solanaInstructions,
		recent.Value.Blockhash,
		solana.TransactionPayer(c.wallet.PublicKey()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	// Sign transaction
	_, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(c.wallet.PublicKey()) {
			return &c.wallet
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	sig, err := c.rpcClient.SendTransaction(context.Background(), tx)
	if err != nil {
		return nil, fmt.Errorf("failed to send transaction: %w", err)
	}

	fmt.Printf("Transaction sent: %s\n", sig)
	return &sig, nil
}

// confirmation method using GetTransaction
func (c *HealthLockClient) WaitForConfirmation(sig solana.Signature) error {
	ctx := context.Background()
	maxRetries := 30
	retryDelay := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		// Wait before checking (except first iteration)
		if i > 0 {
			time.Sleep(retryDelay)
		}

		// Try to get the transaction
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

		// Check if transaction succeeded
		if tx.Meta.Err != nil {
			return fmt.Errorf("transaction failed: %v", tx.Meta.Err)
		}

		fmt.Printf("Transaction confirmed successfully!\n")
		return nil
	}

	return fmt.Errorf("transaction confirmation timeout after %d attempts", maxRetries)
}

func main() {
	// Connect to local validator
	rpcURL := "http://localhost:8899"
	wsURL := "ws://localhost:8900"

	// Create a new wallet
	account := solana.NewWallet()
	fmt.Println("Account private key:", account.PrivateKey)
	fmt.Println("Account public key:", account.PublicKey())

	// Create RPC client for initial airdrop
	rpcClient := rpc.New(rpcURL)

	// Request initial airdrop
	fmt.Println("\n=== Requesting Initial Airdrop ===")
	out, err := rpcClient.RequestAirdrop(
		context.TODO(),
		account.PublicKey(),
		solana.LAMPORTS_PER_SOL*1,
		rpc.CommitmentFinalized,
	)
	if err != nil {
		panic(err)
	}
	fmt.Println("Initial airdrop transaction signature:", out)

	time.Sleep(time.Second * 20)

	// Create client
	client, err := NewHealthLockClient(rpcURL, wsURL, account.PrivateKey)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	balance, err := client.rpcClient.GetBalance(context.Background(), client.wallet.PublicKey(), rpc.CommitmentFinalized)
	if err != nil {
		log.Printf("Failed to get balance: %v", err)
	} else {
		fmt.Printf("Wallet balance: %d lamports (%.2f SOL)\n", balance.Value, float64(balance.Value)/1e9)
	}

	// === Start Tests ===
	fmt.Println("\n=== Testing Program Existence ===")
	if err := client.CheckProgramExists(); err != nil {
		log.Fatalf("Program check failed: %v", err)
	}

	fmt.Println("\n=== Testing Record Counter Read (Before Initialization) ===")
	counter, err := client.GetRecordCounter()
	if err != nil {
		fmt.Printf("Record counter read failed (expected if not initialized): %v\n", err)
	} else {
		fmt.Printf("Record counter already exists with value: %d\n", counter.RecordId)
	}

	// Only initialize if the counter doesn't exist
	if counter == nil {
		fmt.Println("\n=== Initializing Record Counter ===")
		sig2, err := client.InitializeRecordCounter()
		if err != nil {
			fmt.Printf("Record counter init failed: %v\n", err)
		} else {
			fmt.Printf("Record counter initialized! Tx: %s\n", sig2)
			// Wait for this transaction to confirm
			fmt.Println("Waiting for initialization confirmation...")
			err = client.WaitForConfirmation(*sig2)
			if err != nil {
				fmt.Printf("Failed to confirm initialization: %v\n", err)
			} else {
				fmt.Println("Record counter initialization confirmed!")
			}
		}
	}

	fmt.Println("\n=== Testing Record Counter Read (After Initialization) ===")
	counter, err = client.GetRecordCounter()
	if err != nil {
		fmt.Printf("Record counter read failed: %v\n", err)
	} else {
		fmt.Printf("✅ Record counter successfully read!\n")
		fmt.Printf("Current Record ID: %d\n", counter.RecordId)
		fmt.Printf("Next available Record ID will be: %d\n", counter.RecordId+1)
	}

	fmt.Println("\n=== Test Complete ===")
}
