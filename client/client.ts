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

  async updateUserVault(
    name: string,
    age: number,
    owner: Keypair
  ): Promise<string> {
    const [userVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(this.USER_VAULT), owner.publicKey.toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .updateUserVault(new anchor.BN(age), name)
      .accounts({
        userVault: userVaultPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([owner])
      .rpc();

    console.log('✅ user vault updated with transaction:', tx);

    // Fetch and display the updated user vault
    try {
      const userVaultAccount = await this.program.account.userVault.fetch(
        userVaultPda
      );

      const formatted = {
        owner: userVaultAccount.owner.toString(),
        name: userVaultAccount.name,
        age: userVaultAccount.age.toString(),
        recordIds: userVaultAccount.recordIds.map((id: any) => id.toString()),
        createdAt: userVaultAccount.createdAt.toString(),
      };
      console.log(JSON.stringify({ userVault: formatted }, null, 2));
    } catch (fetchError) {
      console.log(
        'Note: Could not fetch updated user vault account:',
        fetchError
      );
    }

    return tx;
  }

  async fetchUserVault(owner: PublicKey): Promise<any> {
    const [userVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(this.USER_VAULT), owner.toBuffer()],
      this.program.programId
    );

    try {
      const userVaultAccount = await this.program.account.userVault.fetch(
        userVaultPda
      );

      const formatted = {
        pda: userVaultPda.toString(),
        owner: userVaultAccount.owner.toString(),
        name: userVaultAccount.name,
        age: userVaultAccount.age.toString(),
        recordIds: userVaultAccount.recordIds.map((id: any) => id.toString()),
        createdAt: userVaultAccount.createdAt.toString(),
      };

      console.log(JSON.stringify({ userVault: formatted }, null, 2));
      return userVaultAccount;
    } catch (error) {
      console.log('User vault not found or not initialized yet');
      return null;
    }
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

    console.log('\n🏥 All Registered Organizations:');
    console.log('==================================');
    allOrganizations.forEach((org, index) => {
      console.log(`\norganizations list ${JSON.stringify(org)}:`);
    });
  }

  async fetchAllRecords(authority: Keypair) {
    console.log('\n=== Fetching all the health records of a user ===');
    const userHealthRecordsFiltered =
      await this.program.account.healthRecord.all([
        {
          memcmp: {
            offset: 8,
            bytes: 'J4KG1GEthENbivCsZgJqa1SYMM2Sgpm8rcEVjy3Ka4ei',
          },
        },
      ]);

    const allHealthRecords = userHealthRecordsFiltered.map((record) => ({
      recordId: record.account.recordId.toNumber(),
      pda: record.publicKey,
      data: record.account,
    }));

    allHealthRecords.forEach((record, index) => {
      console.log(`\nRecords list ${JSON.stringify(record)}:`);
    });
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

  try {
    await client.initializeRecordCounter(authority);
  } catch (err) {
    console.error('❌ Setup failed:', err);
  }

  // try {
  //   await client.updateUserVault("John Doe", 30, authority);
  // } catch (err) {
  //   console.error('❌ User vault update failed:', err);
  // }

  // try {
  //   await client.registerOrganization("test-organization", "guddu", authority);
  // } catch (err) {
  //   console.error('❌  organization Setup failed:', err);
  // }

  // try {
  //   await client.fetchAllOrganizations();
  // } catch (err) {
  //   console.error('❌  organization Setup failed:', err);
  // }

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
