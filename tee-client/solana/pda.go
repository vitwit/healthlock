package solana

import (
	"encoding/binary"

	solana "github.com/gagliardetto/solana-go"
)

func deriveHealthRecordPDA(owner solana.PublicKey, recordID uint64, programID solana.PublicKey) (solana.PublicKey, error) {
	recordIDBuf := make([]byte, 8)
	binary.LittleEndian.PutUint64(recordIDBuf, recordID)

	seeds := [][]byte{
		[]byte("health_record"),
		owner.Bytes(),
		recordIDBuf,
	}

	pubKey, _, err := solana.FindProgramAddress(seeds, programID)
	return pubKey, err
}
