package keys

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
)

type KeyPair struct {
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

// Generate creates a new RSA key pair
func GenerateKeyPair(bits int) (*KeyPair, error) {
	privKey, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		return nil, err
	}
	return &KeyPair{
		PrivateKey: privKey,
		PublicKey:  &privKey.PublicKey,
	}, nil
}

// Encrypt encrypts plaintext using the public key
func (kp *KeyPair) Encrypt(plaintext []byte) (string, error) {
	ciphertext, err := rsa.EncryptPKCS1v15(rand.Reader, kp.PublicKey, plaintext)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64-encoded ciphertext using the private key
func (kp *KeyPair) Decrypt(ciphertextBase64 string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return "", err
	}

	plaintext, err := rsa.DecryptPKCS1v15(rand.Reader, kp.PrivateKey, ciphertext)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// ExportPublicKeyPEM returns the public key in PEM format
func (kp *KeyPair) ExportPublicKeyPEM() (string, error) {
	pubASN1, err := x509.MarshalPKIXPublicKey(kp.PublicKey)
	if err != nil {
		return "", err
	}
	pemBlock := &pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubASN1,
	}
	return string(pem.EncodeToMemory(pemBlock)), nil
}

// ExportPrivateKeyPEM returns the private key in PEM format
func (kp *KeyPair) ExportPrivateKeyPEM() string {
	privASN1 := x509.MarshalPKCS1PrivateKey(kp.PrivateKey)
	pemBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privASN1,
	}
	return string(pem.EncodeToMemory(pemBlock))
}

// ImportPublicKeyPEM imports a PEM-formatted public key
func ImportPublicKeyPEM(pemData string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil || block.Type != "PUBLIC KEY" {
		return nil, errors.New("invalid PEM public key")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not RSA public key")
	}

	return rsaPub, nil
}

func (kp *KeyPair) ExportPublicKeyBase64() (string, error) {
	pubASN1, err := x509.MarshalPKIXPublicKey(kp.PublicKey)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(pubASN1), nil
}
