//go:build intel
// +build intel

package tee

import "fmt"

type IntelAttestor struct{}

func NewAttestor() (Attestor, error) {
	return &IntelAttestor{}, nil
}

func (i *IntelAttestor) GenerateAttestationReport(nonce string) ([]byte, error) {
	return nil, fmt.Errorf("Intel TDX attestation not implemented yet")
}

func (i *IntelAttestor) VerifyAttestationReport(report []byte, expectedNonce string) error {
	return fmt.Errorf("Intel TDX attestation verification not implemented yet")
}
