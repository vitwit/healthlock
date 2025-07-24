import {PublicKey} from '@solana/web3.js';

export interface TEEState {
  signer: string;
  attestation: string;
  pubkey: string;
  isInitialized: boolean;
}

export const parseTEEState = (data: Buffer): TEEState => {
  const DISCRIMINATOR_SIZE = 8;
  let offset = DISCRIMINATOR_SIZE;

  const signer = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const pubkeyLen = data.readUInt32LE(offset);
  offset += 4;
  const pubkey = data.slice(offset, offset + pubkeyLen);
  offset += pubkeyLen;

  const attestationLen = data.readUInt32LE(offset);
  offset += 4;
  const attestation = data.slice(offset, offset + attestationLen);
  offset += attestationLen;

  const isInitialized = data.readUInt8(offset) === 1;

  return {
    signer: signer.toBase58(),
    pubkey: pubkey.toString('base64'),
    attestation: attestation.toString('hex'),
    isInitialized,
  };
};
