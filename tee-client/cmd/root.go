package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
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

	fmt.Println("\n=== Requesting Initial Airdrop ===")
	out, err := solanaClient.RPC().RequestAirdrop(
		context.TODO(),
		solanaClient.GetPubKey(),
		solanago.LAMPORTS_PER_SOL*1,
		rpc.CommitmentFinalized,
	)
	if err != nil {
		panic(err)
	}
	fmt.Println("Initial airdrop transaction signature:", out)

	time.Sleep(time.Second * 20)

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

	printConfigPretty(config)
}

func printConfigPretty(config *config.Config) {
	fmt.Println("********************")
	fmt.Printf("Solana RPC: %s\n", config.Solana.RPC)
	fmt.Printf("Solana WebSocket: %s\n", config.Solana.WebSocket)
	fmt.Printf("Solana Program ID: %s\n", config.Solana.ProgramID)
	fmt.Printf("REST Port: %d\n", config.Rest.Port)
	fmt.Println("********************")
}
