package solana

import (
	"encoding/binary"
	"fmt"
	"log"

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

	record, err := decodeHealthRecord(data)
	if err != nil {
		log.Fatalf("Failed to decode HealthRecord: %v", err)
	}

	return record, nil
}

func decodeHealthRecord(data []byte) (*HealthRecord, error) {
	if len(data) < ANCHOR_DISCRIMINATOR_SIZE+32+8 {
		return nil, fmt.Errorf("data too short")
	}
	offset := ANCHOR_DISCRIMINATOR_SIZE

	var record HealthRecord

	// Owner
	copy(record.Owner[:], data[offset:offset+32])
	offset += 32

	// Record ID
	record.RecordID = binary.LittleEndian.Uint64(data[offset : offset+8])
	offset += 8

	// Encrypted Data
	if len(data) < offset+4 {
		return nil, fmt.Errorf("not enough data for encrypted_data length")
	}
	encLen := binary.LittleEndian.Uint32(data[offset : offset+4])
	offset += 4

	if len(data) < offset+int(encLen) {
		return nil, fmt.Errorf("not enough data for encrypted_data content")
	}
	record.EncryptedData = data[offset : offset+int(encLen)]
	offset += int(encLen)

	// MimeType
	if len(data) < offset+4 {
		return nil, fmt.Errorf("not enough data for mime_type length")
	}
	mimeLen := binary.LittleEndian.Uint32(data[offset : offset+4])
	offset += 4

	if len(data) < offset+int(mimeLen) {
		return nil, fmt.Errorf("not enough data for mime_type content")
	}
	record.MimeType = string(data[offset : offset+int(mimeLen)])
	offset += int(mimeLen)

	// RecordMetadata.FileType
	if len(data) < offset+4 {
		return nil, fmt.Errorf("not enough data for file_type length")
	}
	ftLen := binary.LittleEndian.Uint32(data[offset : offset+4])
	offset += 4

	if len(data) < offset+int(ftLen) {
		return nil, fmt.Errorf("not enough data for file_type content")
	}
	record.Metadata.FileType = string(data[offset : offset+int(ftLen)])
	offset += int(ftLen)

	// FileSize
	if len(data) < offset+8 {
		return nil, fmt.Errorf("not enough data for file_size")
	}
	record.Metadata.FileSize = binary.LittleEndian.Uint64(data[offset : offset+8])
	offset += 8

	// Description
	if len(data) < offset+4 {
		return nil, fmt.Errorf("not enough data for description length")
	}
	descLen := binary.LittleEndian.Uint32(data[offset : offset+4])
	offset += 4

	if len(data) < offset+int(descLen) {
		return nil, fmt.Errorf("not enough data for description content")
	}
	record.Metadata.Description = string(data[offset : offset+int(descLen)])
	offset += int(descLen)

	// Metadata.CreatedAt
	if len(data) < offset+8 {
		return nil, fmt.Errorf("not enough data for metadata.created_at")
	}
	record.Metadata.CreatedAt = int64(binary.LittleEndian.Uint64(data[offset : offset+8]))
	offset += 8

	// CreatedAt
	if len(data) < offset+8 {
		return nil, fmt.Errorf("not enough data for created_at")
	}
	record.CreatedAt = int64(binary.LittleEndian.Uint64(data[offset : offset+8]))
	offset += 8

	// Access List
	if len(data) < offset+4 {
		return nil, fmt.Errorf("not enough data for access_list length")
	}
	accessLen := binary.LittleEndian.Uint32(data[offset : offset+4])
	offset += 4

	record.AccessList = make([]AccessPermission, 0, accessLen)

	for i := 0; i < int(accessLen); i++ {
		var perm AccessPermission

		// Organization pubkey
		if len(data) < offset+32 {
			return nil, fmt.Errorf("not enough data for organization pubkey")
		}
		copy(perm.Organization[:], data[offset:offset+32])
		offset += 32

		// Organization name
		if len(data) < offset+4 {
			return nil, fmt.Errorf("not enough data for org name length")
		}
		orgNameLen := binary.LittleEndian.Uint32(data[offset : offset+4])
		offset += 4

		if len(data) < offset+int(orgNameLen) {
			return nil, fmt.Errorf("not enough data for org name")
		}
		perm.OrganizationName = string(data[offset : offset+int(orgNameLen)])
		offset += int(orgNameLen)

		// GrantedAt
		if len(data) < offset+8 {
			return nil, fmt.Errorf("not enough data for granted_at")
		}
		perm.GrantedAt = int64(binary.LittleEndian.Uint64(data[offset : offset+8]))
		offset += 8

		// ExpiresAt (Option<i64>)
		if len(data) < offset+1 {
			return nil, fmt.Errorf("not enough data for expires_at option")
		}
		expiresFlag := data[offset]
		offset += 1

		if expiresFlag == 1 {
			if len(data) < offset+8 {
				return nil, fmt.Errorf("not enough data for expires_at value")
			}
			val := int64(binary.LittleEndian.Uint64(data[offset : offset+8]))
			perm.ExpiresAt = &val
			offset += 8
		}

		record.AccessList = append(record.AccessList, perm)
	}

	// IsActive (bool)
	if len(data) < offset+1 {
		return nil, fmt.Errorf("not enough data for is_active")
	}
	record.IsActive = data[offset] != 0
	offset += 1

	return &record, nil
}
