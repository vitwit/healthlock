package config

type Config struct {
	Solana SolanaConfig `toml:"solana"`
	Rest   RestConfig   `toml:"rest"`
}

type SolanaConfig struct {
	RPC       string `toml:"rpc"`
	WebSocket string `toml:"websocket"`
	ProgramID string `toml:"program-id"`
}

type RestConfig struct {
	Port int `toml:"port"`
}
