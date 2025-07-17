//go:build !amd && !intel
// +build !amd,!intel

package tee

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

type Attestor interface {
	GenerateAttestationReport(nonce string) ([]byte, error)
	VerifyAttestationReport(report []byte, expectedNonce string) error
}

func BuildAttestationNonce(address, pubkey string) (string, error) {
	payload := map[string]interface{}{
		"address": address,
		"pubkey":  pubkey,
	}
	nonce, err := GenerateNonce(payload)
	return nonce, err
}

func GenerateNonce(payload map[string]interface{}) (string, error) {
	tag := []byte("TEENONCE:")
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	tagged := append(tag, jsonBytes...)
	hash := sha256.Sum256(tagged)
	return hex.EncodeToString(hash[:]), nil
}
