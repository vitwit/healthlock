//go:build mock
// +build mock

package tee

import (
	"crypto/rand"
	"fmt"
)

type MockAttestor struct{}

func NewAttestor() (Attestor, error) {
	return &MockAttestor{}, nil
}

func (d *MockAttestor) GenerateAttestationReport(nonce string) ([]byte, error) {
	// Return 256 bytes of random data
	randomBytes := make([]byte, 256)
	_, err := rand.Read(randomBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to generate random report: %v", err)
	}
	fmt.Println("🧪 [Mock] Returning random attestation report")
	return randomBytes, nil
}

func (d *MockAttestor) VerifyAttestationReport(report []byte, expectedNonce string) error {
	fmt.Println("✅ [Mock] Attestation always verified successfully")
	return nil
}
