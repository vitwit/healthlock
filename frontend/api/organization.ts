import {
    Connection,
    PublicKey,
} from '@solana/web3.js';
import { PROGRAM_ID } from '../util/constants';

const ORGANIZATION_DISCRIMINATOR = Buffer.from([
    145, 38, 152, 251, 91, 57, 118, 160
]);

export interface Organization {
    pubkey: string;
    owner: string;
    organizationId: string;
    name: string;
    contactInfo: string;
    description: string;
    recordIds: string[]; // use string to handle big numbers safely
    createdAt: number;
}
function decodeAnchorString(buffer: Buffer, offset: number): { value: string, nextOffset: number } {
    const len = buffer.readUInt32LE(offset);
    const start = offset + 4;
    const end = start + len;
    const value = buffer.slice(start, end).toString('utf8');
    return { value, nextOffset: end };
}


export async function getOrganization(
    connection: Connection,
    owner: PublicKey
): Promise<Organization> {
    const [organizationPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('organization'), owner.toBuffer()],
        PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(organizationPDA);
    if (!accountInfo) throw new Error('Organization account not found');

    const data = accountInfo.data;

    // Validate discriminator
    const discriminator = data.slice(0, 8);
    if (!discriminator.equals(ORGANIZATION_DISCRIMINATOR)) {
        throw new Error('Invalid account discriminator — not an Organization');
    }

    let offset = 8;

    // owner: Pubkey (32 bytes)
    const accountOwner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // organization_id: u64 (8 bytes)
    const organizationId = data.readBigUInt64LE(offset);
    offset += 8;

    // name: string
    const { value: name, nextOffset: afterName } = decodeAnchorString(data, offset);
    offset = afterName;

    // contact_info: string
    const { value: contactInfo, nextOffset: afterContact } = decodeAnchorString(data, offset);
    offset = afterContact;

    // created_at: i64 (8 bytes)
    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;

    // description: string
    const { value: description, nextOffset: afterDesc } = decodeAnchorString(data, offset);
    offset = afterDesc;

    // record_ids: Vec<u64>
    const recordIdsLen = data.readUInt32LE(offset); // Anchor encodes Vec<T> with a u32 length prefix
    offset += 4;

    const recordIds: string[] = [];
    for (let i = 0; i < recordIdsLen; i++) {
        const recordId = data.readBigUInt64LE(offset);
        recordIds.push(recordId.toString());
        offset += 8;
    }

    return {
        pubkey: organizationPDA.toBase58(),
        owner: accountOwner.toBase58(),
        organizationId: organizationId.toString(),
        name,
        contactInfo,
        description,
        recordIds,
        createdAt,
    };
}
