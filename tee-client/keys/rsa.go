package keys

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
)

type KeyPair struct {
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

// GenerateKeyPair creates a new RSA key pair
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

// HybridEncryptedData represents encrypted output with RSA + AES
type HybridEncryptedData struct {
	EncryptedAESKey string `json:"encrypted_aes_key"` // base64
	Ciphertext      string `json:"ciphertext"`        // base64
	Nonce           string `json:"nonce"`             // base64
}

// EncryptFile encrypts large content using AES, and AES key using RSA
func (kp *KeyPair) EncryptFile(plaintext []byte) ([]byte, error) {
	// Generate AES-256 key
	aesKey := make([]byte, 32)
	if _, err := rand.Read(aesKey); err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, aesgcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := aesgcm.Seal(nil, nonce, plaintext, nil)

	// Encrypt AES key with RSA
	rsaEncryptedKey, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, kp.PublicKey, aesKey, nil)
	if err != nil {
		return nil, err
	}

	// Encode all parts
	enc := HybridEncryptedData{
		EncryptedAESKey: base64.StdEncoding.EncodeToString(rsaEncryptedKey),
		Ciphertext:      base64.StdEncoding.EncodeToString(ciphertext),
		Nonce:           base64.StdEncoding.EncodeToString(nonce),
	}

	return json.Marshal(enc)
}

// DecryptFile decrypts data encrypted by EncryptFile()
func (kp *KeyPair) DecryptFile(data []byte) ([]byte, error) {
	var enc HybridEncryptedData
	if err := json.Unmarshal(data, &enc); err != nil {
		return nil, err
	}

	// Decode base64 parts
	encryptedAESKey, err := base64.StdEncoding.DecodeString(enc.EncryptedAESKey)
	if err != nil {
		return nil, err
	}
	ciphertext, err := base64.StdEncoding.DecodeString(enc.Ciphertext)
	if err != nil {
		return nil, err
	}
	nonce, err := base64.StdEncoding.DecodeString(enc.Nonce)
	if err != nil {
		return nil, err
	}

	// Decrypt AES key with RSA
	aesKey, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, kp.PrivateKey, encryptedAESKey, nil)
	if err != nil {
		return nil, err
	}

	// Decrypt ciphertext with AES
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return aesgcm.Open(nil, nonce, ciphertext, nil)
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

// ExportPublicKeyBase64 returns the public key as base64 DER
func (kp *KeyPair) ExportPublicKeyBase64() (string, error) {
	pubASN1, err := x509.MarshalPKIXPublicKey(kp.PublicKey)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(pubASN1), nil
}

func (kp *KeyPair) DecryptBase64Bytes(ciphertext []byte) ([]byte, error) {
	return rsa.DecryptPKCS1v15(rand.Reader, kp.PrivateKey, ciphertext)
}
