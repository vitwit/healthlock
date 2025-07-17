package solana

import solanago "github.com/gagliardetto/solana-go"

const ANCHOR_DISCRIMINATOR_SIZE = 8

type RecordMetadata struct {
	FileType    string
	FileSize    uint64
	Description string
	CreatedAt   int64
}

type AccessPermission struct {
	Organization     solanago.PublicKey
	OrganizationName string
	GrantedAt        int64
	ExpiresAt        *int64 // optional
}

type HealthRecord struct {
	Owner         solanago.PublicKey
	RecordID      uint64
	MimeType      string
	EncryptedData []byte
	Metadata      RecordMetadata
	CreatedAt     int64
	AccessList    []AccessPermission
	IsActive      bool
}
