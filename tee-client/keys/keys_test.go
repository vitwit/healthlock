package keys_test

import (
	"bytes"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"

	"github.com/vitwit/healthlock/tee-client/keys"
)

func TestEncryptDecryptImage(t *testing.T) {
	// Generate RSA key pair
	kp, err := keys.GenerateKeyPair(2048)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	// Load image into memory
	imgPath := filepath.Join("testdata", "sample.png")
	plaintext, err := os.ReadFile(imgPath)
	if err != nil {
		t.Fatalf("Failed to read image file: %v", err)
	}

	// Encrypt
	encrypted, err := kp.EncryptFile(plaintext)
	if err != nil {
		t.Fatalf("Failed to encrypt image: %v", err)
	}

	// Decrypt
	decrypted, err := kp.DecryptFile(encrypted)
	if err != nil {
		t.Fatalf("Failed to decrypt image: %v", err)
	}

	// Check integrity
	if !bytes.Equal(plaintext, decrypted) {
		t.Error("Original and decrypted image data do not match")
	}

}

func TestPEMExportImport(t *testing.T) {
	kp, err := keys.GenerateKeyPair(2048)
	if err != nil {
		t.Fatal(err)
	}

	pemStr, err := kp.ExportPublicKeyPEM()
	if err != nil {
		t.Fatal(err)
	}

	pubKey, err := keys.ImportPublicKeyPEM(pemStr)
	if err != nil {
		t.Fatal(err)
	}

	// Check if imported key matches
	if pubKey.N.Cmp(kp.PublicKey.N) != 0 {
		t.Error("Imported public key does not match original")
	}
}

func TestExportPublicKeyBase64(t *testing.T) {
	kp, err := keys.GenerateKeyPair(2048)
	if err != nil {
		t.Fatal(err)
	}

	b64, err := kp.ExportPublicKeyBase64()
	if err != nil {
		t.Fatal(err)
	}

	_, err = base64.StdEncoding.DecodeString(b64)
	if err != nil {
		t.Error("Invalid base64 public key")
	}
}

func TestDecryptNodeEncryptedFile(t *testing.T) {
	// Load private key from PEM
	privKeyPEM, err := os.ReadFile("private.pem")
	if err != nil {
		t.Fatalf("Failed to read private.pem: %v", err)
	}

	block, _ := keys.ImportPrivateKeyPEM(string(privKeyPEM))
	kp := &keys.KeyPair{PrivateKey: block, PublicKey: &block.PublicKey}

	// Load encrypted file from Node.js
	encryptedData, err := os.ReadFile("encrypted.json")
	if err != nil {
		t.Fatalf("Failed to read encrypted.json: %v", err)
	}

	// Decrypt
	decrypted, err := kp.DecryptFile(encryptedData)
	if err != nil {
		t.Fatalf("Decryption failed: %v", err)
	}

	// Optional: Save decrypted image
	err = os.WriteFile(filepath.Join("decrypted_output.jpg"), decrypted, 0644)
	if err != nil {
		t.Fatalf("Failed to save decrypted image: %v", err)
	}

	t.Log("✅ Successfully decrypted and saved as decrypted_output.jpg")
}
