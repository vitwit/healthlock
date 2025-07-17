package solana

import (
	"fmt"
	"log"

	bin "github.com/gagliardetto/binary"
	solanago "github.com/gagliardetto/solana-go"
	"github.com/vitwit/healthlock/tee-client/types"
)

func (c *Client) ReadHealthRecord(ctx types.Context, owner solanago.PublicKey, recordID uint64) (*HealthRecord, error) {
	pda, err := deriveHealthRecordPDA(owner, recordID, c.programKey)
	if err != nil {
		return nil, fmt.Errorf("failed to derive PDA: %w", err)
	}

	accountInfo, err := c.rpcClient.GetAccountInfo(ctx.Context(), pda)
	if err != nil {
		return nil, err
	}

	data := accountInfo.Value.Data.GetBinary()
	record, err := decodeHealthRecord(data[8:])
	if err != nil {
		log.Fatalf("Failed to decode HealthRecord: %v", err)
	}

	return record, nil
}

func decodeHealthRecord(data []byte) (*HealthRecord, error) {
	var record HealthRecord
	borshDec := bin.NewBorshDecoder(data)
	if err := borshDec.Decode(&record); err != nil {
		return nil, err
	}

	return &record, nil
}
