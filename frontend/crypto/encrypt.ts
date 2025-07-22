import forge from 'node-forge';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

/**
 * Copies an image (or file) to the app’s temp directory.
 * Only supports Android content URIs.
 */
export const copyToTemp = async (uri: string): Promise<string> => {
  const filename = `temp_${Date.now()}.jpg`; // or extract from original
  const destPath = `${RNFS.TemporaryDirectoryPath}/${filename}`;

  let fileContent;

  if (Platform.OS === 'android' && uri.startsWith('content://')) {
    const res = await fetch(uri); // content:// scheme must be handled this way
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await RNFS.writeFile(destPath, buffer.toString('base64'), 'base64');
  } else {
    // for file:// or already local paths
    await RNFS.copyFile(uri, destPath);
  }

  return destPath;
};

export interface HybridEncryptedData {
  encrypted_aes_key: string; // base64 RSA-encrypted AES key
  ciphertext: string;        // base64 AES-GCM encrypted content
  nonce: string;             // base64 IV
}

export const importBase64RSAPublicKey = (base64Key: string): forge.pki.rsa.PublicKey => {
  try {
    const derBytes = forge.util.decode64(base64Key);
    const byteBuffer = forge.util.createBuffer(derBytes, 'raw');

    // 🚨 Notice the `false` argument (strict = false)
    const asn1 = forge.asn1.fromDer(byteBuffer, false);

    const publicKey = forge.pki.publicKeyFromAsn1(asn1);
    return publicKey as forge.pki.rsa.PublicKey;
  } catch (err) {
    console.error("🔴 Failed to parse base64 DER public key:", err);
    throw new Error('Invalid RSA public key');
  }
};



/**
 * Encrypts a file using hybrid RSA + AES-GCM encryption.
 */
export const encryptFile = async (
  filePath: string,
  base64EncodedPEMPubKey: string
): Promise<HybridEncryptedData> => {
  // Step 1: Read file and decode base64 into binary string
  const fileBase64 = await RNFS.readFile(filePath, 'base64');
  const fileBytes = forge.util.decode64(fileBase64); // binary string

  // Step 2: Generate AES-256 key and 12-byte nonce
  const aesKey = forge.random.getBytesSync(32); // 256 bits
  const nonce = forge.random.getBytesSync(12);  // 96-bit nonce

  // Step 3: AES-GCM encryption
  const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
  cipher.start({ iv: nonce });
  cipher.update(forge.util.createBuffer(fileBytes));
  const success = cipher.finish();
  if (!success) throw new Error('AES encryption failed');
  const ciphertext = cipher.output.getBytes(); // Encrypted + AuthTag

  // Step 4: Import RSA key from base64-encoded PEM
  const publicKey = importBase64RSAPublicKey(base64EncodedPEMPubKey);

  // Step 5: Encrypt AES key with RSA-OAEP (SHA-256)
  const encryptedAesKey = publicKey.encrypt(aesKey, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });

  // Step 6: Return result as base64-encoded fields
  return {
    encrypted_aes_key: forge.util.encode64(encryptedAesKey),
    ciphertext: forge.util.encode64(ciphertext),
    nonce: forge.util.encode64(nonce),
  };
};
