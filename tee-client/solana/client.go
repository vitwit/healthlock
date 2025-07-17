package solana

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"time"

	solana "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
	"github.com/vitwit/healthlock/tee-client/types"
)

type Client struct {
	rpcClient *rpc.Client
	wsClient  *ws.Client

	wallet solana.PrivateKey
	pubKey solana.PublicKey

	programKey solana.PublicKey
}

func NewClient(ctx *types.Context) (*Client, error) {

	cfg := ctx.GetConfig()

	rpcClient := rpc.New(cfg.Solana.RPC)
	wsClient, err := ws.Connect(context.Background(), cfg.Solana.WebSocket)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to websocket: %w", err)
	}

	return &Client{
		rpcClient:  rpcClient,
		wsClient:   wsClient,
		programKey: solana.MustPublicKeyFromBase58(ctx.GetConfig().Solana.ProgramID),
	}, nil
}

func (c *Client) RPC() *rpc.Client {
	return c.rpcClient
}

func (c *Client) CreateWallet() error {
	fmt.Println("================== Generating Wallet ===================")
	account := solana.NewWallet()

	c.wallet = account.PrivateKey
	c.pubKey = account.PublicKey()
	fmt.Println("Public Key: ", c.pubKey.String())
	fmt.Println("===========================================================")

	return nil
}

func (c *Client) GetPubKey() solana.PublicKey {
	return c.pubKey
}

func (c *Client) GetPubKeyString() string {
	return c.pubKey.String()
}

// CheckProgramExists checks if the program exists on the network
func (c *Client) CheckProgramExists(ctx *types.Context) error {
	accountInfo, err := c.rpcClient.GetAccountInfo(ctx.Context(), c.programKey)
	if err != nil {
		return fmt.Errorf("failed to get program account info: %w", err)
	}

	if accountInfo.Value == nil {
		return fmt.Errorf("program account not found")
	}

	fmt.Printf("Program found! Owner: %s\n", accountInfo.Value.Owner)
	return nil
}

// calculateDiscriminator generates the 8-byte discriminator for Anchor instructions
func calculateDiscriminator(name string) []byte {
	hash := sha256.Sum256([]byte(name))
	return hash[:8]
}

func (c *Client) findProgramAddress(ctx types.Context, seeds [][]byte) (solana.PublicKey, uint8, error) {
	programKey := solana.MustPublicKeyFromBase58(ctx.GetConfig().Solana.ProgramID)
	return solana.FindProgramAddress(seeds, programKey)
}

// RegisterTEENode registers a new TEE node with the given public key and attestation
func (c *Client) RegisterTEENode(ctx types.Context, pubkey, attestation []byte) (*solana.Signature, error) {
	statePDA, _, err := c.findProgramAddress(ctx, [][]byte{
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
		ProgID:        c.programKey,
		AccountValues: accounts,
		DataBytes:     instructionData,
	}

	return c.sendTransaction(ctx, []*solana.GenericInstruction{instruction})
}

// sendTransaction sends a transaction to the network
func (c *Client) sendTransaction(ctx types.Context, instructions []*solana.GenericInstruction) (*solana.Signature, error) {
	recent, err := c.rpcClient.GetLatestBlockhash(ctx.Context(), rpc.CommitmentFinalized)
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
func (c *Client) WaitForConfirmation(ctx types.Context, sig solana.Signature) error {
	maxRetries := 30
	retryDelay := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		if i > 0 {
			time.Sleep(retryDelay)
		}

		tx, err := c.rpcClient.GetTransaction(ctx.Context(), sig, &rpc.GetTransactionOpts{
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
