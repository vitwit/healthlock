import { PublicKey } from '@solana/web3.js';

/**
 * Shortens a Solana public key to a compact format like "Abcd...WXYZ"
 * @param publicKey The PublicKey object (or undefined/null)
 * @param chars Number of characters to keep on each side (default: 4)
 * @returns A shortened address string or empty string if invalid
 */
export function shortenAddress(publicKey?: PublicKey | null, chars = 4): string {
    if (!publicKey) return '';

    const base58 = publicKey.toBase58();

    if (base58.length <= chars * 2 + 3) return base58;

    return `${base58.slice(0, chars)}...${base58.slice(-chars)}`;
}
