package solana

import solanago "github.com/gagliardetto/solana-go"

const ANCHOR_DISCRIMINATOR_SIZE = 8

type AccessPermission struct {
	Organization solanago.PublicKey `borsh:"organization"`
	GrantedAt    int64              `borsh:"granted_at"`
}

type HealthRecord struct {
	Owner         solanago.PublicKey `borsh:"owner"`
	RecordID      uint64             `borsh:"record_id"`
	EncryptedData []byte             `borsh:"encrypted_data"`
	CreatedAt     int64              `borsh:"created_at"`
	AccessList    []AccessPermission `borsh:"access_list"`
	MimeType      string             `borsh:"mime_type"`
	FileSize      uint64             `borsh:"file_size"`
	Description   string             `borsh:"description"`
	Title         string             `borsh:"title"`
}
