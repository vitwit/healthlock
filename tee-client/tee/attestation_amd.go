//go:build amd
// +build amd

package tee

import (
	"bytes"
	"encoding/hex"
	"fmt"

	"github.com/google/go-sev-guest/client"
	"github.com/google/go-sev-guest/verify"
)

type AmdAttestor struct{}

func NewAttestor() (Attestor, error) {
	return &AmdAttestor{}, nil
}

func (a *AmdAttestor) GenerateAttestationReport(nonce string) ([]byte, error) {
	nonceBytes, err := hex.DecodeString(nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nonce: %v", err)
	}
	if len(nonceBytes) > 64 {
		return nil, fmt.Errorf("nonce too long; must be <= 64 bytes")
	}

	var reportData [64]byte
	copy(reportData[:], nonceBytes)

	dev, err := client.OpenDevice()
	if err != nil {
		return nil, fmt.Errorf("cannot open /dev/sev-guest: %v", err)
	}
	defer dev.Close()

	report, err := client.GetRawReport(dev, reportData)
	if err != nil {
		return nil, fmt.Errorf("failed to get attestation report: %v", err)
	}

	return report, nil
}

func (a *AmdAttestor) VerifyAttestationReport(report []byte, expectedNonce string) error {
	options := verify.DefaultOptions()
	if err := verify.RawSnpReport(report, options); err != nil {
		return fmt.Errorf("attestation signature verification failed: %v", err)
	}

	nonceBytes, err := hex.DecodeString(expectedNonce)
	if err != nil {
		return fmt.Errorf("invalid nonce format: %v", err)
	}
	if len(report) < 128 {
		return fmt.Errorf("attestation report too short")
	}

	reportData := report[64:128]
	for i := 0; i <= 64-len(nonceBytes); i++ {
		if bytes.Equal(reportData[i:i+len(nonceBytes)], nonceBytes) {
			return nil
		}
	}
	return fmt.Errorf("nonce hash not found in report_data")
}
