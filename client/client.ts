import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Healthlock } from '../target/types/healthlock';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  Connection,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { access, readFileSync } from 'fs';

export class HealthLockClient {
  private program: Program<Healthlock>;
  public provider: anchor.Provider;
  public creatorTokenAccount: anchor.web3.PublicKey;

  private readonly ORGANIZATION_SEED = 'organization';
  private readonly TEE_SEED = 'state';
  private readonly HEALTH_RECORD_SEED = 'health_record';
  private readonly RECORD_COUNTER_SEED = 'record_counter';
  private readonly USER_VAULT = 'user_vault';

  constructor() {
    anchor.setProvider(anchor.AnchorProvider.env());
    this.program = anchor.workspace.Healthlock as Program<Healthlock>;
    this.provider = anchor.getProvider();
  }

  async initializeRecordCounter(authority: Keypair): Promise<string> {
    const [recordCounterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(this.RECORD_COUNTER_SEED)],
      this.program.programId
    );

    const tx = await this.program.methods
      .initializeRecordCounter()
      .accounts({
        recordCounter: recordCounterPda,
        owner: authority.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([authority])
      .rpc();

    console.log('✅ record counter initialized with transaction:', tx);

    const recordCounter = await this.program.account.recordCounter.fetch(
      recordCounterPda
    );

    const formatted = {
      recordId: recordCounter.recordId.toString(),
    };
    console.log(JSON.stringify({ recordCounter: formatted }, null, 1));

    return tx;
  }

//   async registerOrganization(
//     name: string,
//     contact_info: string,
//     authority: Keypair
//   ): Promise<string> {
//     const [organizationPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from(this.ORGANIZATION_SEED), authority.publicKey.toBuffer()],
//       this.program.programId
//     );

//     const registerOrgTx = await this.program.methods
//       .registerOrganization(name, contact_info)
//       .accountsStrict({
//         organization: organizationPda,
//         owner: authority.publicKey,
//         systemProgram: SystemProgram.programId,
//       })
//       .signers([authority])
//       .rpc();

//     console.log('✅ organization registered with transaction:', registerOrgTx);

//     const organizationAccount = await this.program.account.organization.fetch(
//       organizationPda
//     );

//     const formatted = {
//       name: organizationAccount.name.toString(),
//       owner: anchor.web3.PublicKey,
//       organizationId: organizationAccount.organizationId.toString(),
//       contactInfo: organizationAccount.contactInfo.toString(),
//       createdAt: organizationAccount.owner.toString(),
//     };
//     console.log(JSON.stringify({ organizationAccount: formatted }, null, 1));

//     return registerOrgTx;
//   }

  async fetchAllOrganizations() {
    const allOrganizations = await this.program.account.organization.all();
    
    console.log(`\nTotal organizations registered: ${allOrganizations.length}`);
    
    console.log("\n🏥 All Registered Organizations:");
    console.log("==================================");
    allOrganizations.forEach((org, index) => {
      console.log(`\norganizations list ${JSON.stringify(org)}:`);
    });
  }

  async fetchAllRecords(authority: Keypair) {
    console.log("\n=== Fetching all the health records of a user ===");
    const userHealthRecordsFiltered = await this.program.account.healthRecord.all([
      {
        memcmp: {
          offset: 8,
          bytes:"J4KG1GEthENbivCsZgJqa1SYMM2Sgpm8rcEVjy3Ka4ei",
        },
      },
    ]);

    const allHealthRecords = userHealthRecordsFiltered.map(record => ({
      recordId: record.account.recordId.toNumber(),
      pda: record.publicKey,
      data: record.account
    }));

    allHealthRecords.forEach((record, index) => {
      console.log(`\nRecords list ${JSON.stringify(record)}:`);
    })

  }
}

// ------------------------
// ✅ Main usage example
// ------------------------

async function main() {
  const client = new HealthLockClient();

  const authority = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(`${process.env.ANCHOR_WALLET}`, 'utf-8'))
    )
  );

  const platformWallet = authority;
  const creator = authority;

  // try {
  //   await client.initializeRecordCounter(authority);
  // } catch (err) {
  //   console.error('❌ Setup failed:', err);
  // }

  // try {
  //   await client.registerOrganization("test-organization", "guddu", authority);
  // } catch (err) {
  //   console.error('❌  organization Setup failed:', err);
  // }

  try {
    await client.fetchAllOrganizations();
  } catch (err) {
    console.error('❌  organization Setup failed:', err);
  }

  // try {
  //   await client.fetchAllRecords(authority);
  // } catch (err) {
  //   console.error('❌  organization Setup failed:', err);
  // }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);