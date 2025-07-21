import forge from 'node-forge';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

export interface HybridEncryptedData {
    encrypted_aes_key: string; // base64-encoded RSA-encrypted AES key
    ciphertext: string;        // base64-encoded AES-GCM ciphertext
    nonce: string;             // base64-encoded nonce (IV)
}


export const copyToTemp = async (contentUri: string): Promise<string> => {
  const destPath = `${RNFS.TemporaryDirectoryPath}/${Date.now()}.jpg`;

  if (Platform.OS === 'android') {
    const uriParts = contentUri.split('/');
    const fileName = uriParts[uriParts.length - 1];
    const dest = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
    await RNFS.copyFile(contentUri, dest);
    return dest;
  } else {
    throw new Error("Use document picker or other APIs on iOS");
  }
};


/**
 * Imports a base64-encoded RSA public key (DER format) and returns a Forge public key object.
 */
export const importBase64RSAPublicKey = (base64Key: string) => {
  try {
    const derBytes = forge.util.decode64(base64Key);
    const byteBuffer = forge.util.createBuffer(derBytes, 'raw');

    const asn1 = forge.asn1.fromDer(byteBuffer);

    const publicKey = forge.pki.publicKeyFromAsn1(asn1);
    return publicKey;
  } catch (err) {
    console.error("Invalid RSA public key format:", err);
    throw new Error('Failed to parse RSA public key');
  }
};

/**
 * Encrypts a file using AES-GCM and encrypts the AES key using RSA-OAEP.
 */
export const encryptFile = async (
  filePath: string,
  base64PublicKey: string
): Promise<HybridEncryptedData> => {
  // Step 1: Read file as base64 and decode to binary
  const fileBase64 = await RNFS.readFile(filePath, 'base64');
  const fileBytes = forge.util.decode64(fileBase64);

  // Step 2: Generate AES-256 key and 96-bit nonce
  const aesKey = forge.random.getBytesSync(32); // 256-bit AES key
  const nonce = forge.random.getBytesSync(12);  // 96-bit nonce

  // Step 3: Encrypt file using AES-GCM
  const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
  cipher.start({ iv: nonce });
  cipher.update(forge.util.createBuffer(fileBytes));
  const success = cipher.finish();
  if (!success) throw new Error('AES encryption failed');
  const ciphertext = cipher.output.getBytes(); // raw bytes

  // Step 4: Import RSA public key and encrypt AES key
  const publicKey = importBase64RSAPublicKey(base64PublicKey);
  const encryptedAesKey = publicKey.encrypt(aesKey, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });

  // Step 5: Return hybrid-encrypted data
  return {
    encrypted_aes_key: forge.util.encode64(encryptedAesKey),
    ciphertext: forge.util.encode64(ciphertext),
    nonce: forge.util.encode64(nonce),
  };
};