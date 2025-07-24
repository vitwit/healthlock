package config

type Config struct {
	Solana SolanaConfig `toml:"solana"`
	Rest   RestConfig   `toml:"rest"`
}

type SolanaConfig struct {
	RPC         string `toml:"rpc"`
	WebSocket   string `toml:"websocket"`
	ProgramID   string `toml:"program-id"`
	NetworkType string `toml:"network-type"` // e.g. "local", "devnet", "mainnet"
}

type RestConfig struct {
	Port int `toml:"port"`
}
