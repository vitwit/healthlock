import {Connection, PublicKey} from '@solana/web3.js';
import {PROGRAM_ID} from '../util/constants';

import {sha256} from 'js-sha256';

const USER_VAULT_DISCRIMINATOR = Buffer.from(
  sha256.digest('account:UserVault').slice(0, 8),
);

export interface User {
  pubkey: string;
  owner: string;
  recordIds: string[];
  createdAt: number;
  name: string;
  age: number;
}

function decodeAnchorString(
  buffer: Buffer,
  offset: number,
): {value: string; nextOffset: number} {
  const len = buffer.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  const value = buffer.slice(start, end).toString('utf8');
  return {value, nextOffset: end};
}

export async function getUser(
  connection: Connection,
  owner: PublicKey,
): Promise<User> {
  const [userVaultPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('user_vault'), owner.toBuffer()],
    PROGRAM_ID,
  );

  const accountInfo = await connection.getAccountInfo(userVaultPDA);
  if (!accountInfo) throw new Error('User vault account not found');

  const data = accountInfo.data;

  // Validate discriminator
  const discriminator = data.slice(0, 8);
  if (!discriminator.equals(USER_VAULT_DISCRIMINATOR)) {
    throw new Error('Invalid account discriminator — not a UserVault');
  }

  let offset = 8;

  // owner: Pubkey (32 bytes)
  const accountOwner = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // record_ids: Vec<u64>
  const recordIdsLen = data.readUInt32LE(offset);
  offset += 4;
  const recordIds: string[] = [];
  for (let i = 0; i < recordIdsLen; i++) {
    const recordId = data.readBigUInt64LE(offset);
    recordIds.push(recordId.toString());
    offset += 8;
  }

  // created_at: i64 (8 bytes)
  const createdAt = Number(data.readBigInt64LE(offset));
  offset += 8;

  // name: string
  const {value: name, nextOffset: afterName} = decodeAnchorString(data, offset);
  offset = afterName;

  // age: u64 (8 bytes)
  const age = Number(data.readBigUInt64LE(offset));
  offset += 8;

  return {
    pubkey: userVaultPDA.toBase58(),
    owner: accountOwner.toBase58(),
    recordIds,
    createdAt,
    name,
    age,
  };
}
