import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Healthlock } from '../target/types/healthlock';
import { expect } from 'chai';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';

describe('healthlock', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Healthlock as Program<Healthlock>;
  const owner = provider.wallet;
  const organizationOwner = Keypair.generate();

  let recordCounter: PublicKey;
  let userVault: PublicKey;
  let organization: PublicKey;

  before(async () => {
    [recordCounter] = PublicKey.findProgramAddressSync(
      [Buffer.from('record_counter')],
      program.programId
    );

    [userVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_vault'), owner.publicKey.toBuffer()],
      program.programId
    );
  });

  describe('Initialize Counters', () => {
    it('Should initialize record counter', async () => {
      await program.methods
        .initializeRecordCounter()
        .accountsStrict({
          recordCounter: recordCounter,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      expect(recordCounterAccount.recordId.toNumber()).to.equal(1);
    });

    it('Should fail to initialize record counter again', async () => {
      try {
        await program.methods
          .initializeRecordCounter()
          .accountsStrict({
            recordCounter: recordCounter,
            owner: owner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('already in use');
      }
    });
  });
  describe('Register Organization', () => {
    it('Should register a new organization', async () => {
      await provider.connection.requestAirdrop(
        organizationOwner.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      [organization] = PublicKey.findProgramAddressSync(
        [Buffer.from('organization'), organizationOwner.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .registerOrganization('Test Hospital', 'contact@testhospital.com')
        .accountsStrict({
          organization: organization,
          owner: organizationOwner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([organizationOwner])
        .rpc();

      console.log('Register organization transaction signature:', tx);

      const organizationAccount = await program.account.organization.fetch(
        organization
      );

      expect(organizationAccount.owner.toString()).to.equal(
        organizationOwner.publicKey.toString()
      );
      expect(organizationAccount.name).to.equal('Test Hospital');
      expect(organizationAccount.contactInfo).to.equal(
        'contact@testhospital.com'
      );
      expect(organizationAccount.createdAt.toNumber()).to.be.greaterThan(0);
    });
  });

  describe('Upload Health Record', () => {
    let healthRecord: PublicKey;
    let userVault: PublicKey;

    beforeEach(async () => {
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const currentRecordId = recordCounterAccount.recordId;

      [healthRecord] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('health_record'),
          owner.publicKey.toBuffer(),
          Buffer.from(currentRecordId.toArrayLike(Buffer, 'le', 8)),
        ],
        program.programId
      );

      [userVault] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_vault'), owner.publicKey.toBuffer()],
        program.programId
      );
    });

    it('Should upload a health record', async () => {
      const encryptedData = Buffer.from([1, 2, 3, 4, 5]);
      const mimeType = "PDF";
      const fileSize = new anchor.BN(encryptedData.length);
      const description = "Test health record";
      const title = "July 2025 Report";

      const tx = await program.methods
        .uploadHealthRecord(encryptedData, mimeType, fileSize, description, title)
        .uploadHealthRecord(encryptedData, mimeType, fileSize, description, title)
        .accountsStrict({
          userVault,
          recordCounter,
          healthRecord,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Upload health record transaction signature:', tx);

      const healthRecordAccount = await program.account.healthRecord.fetch(
        healthRecord
      );
      expect(healthRecordAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
      expect(healthRecordAccount.recordId.toNumber()).to.equal(1);
      expect(Buffer.from(healthRecordAccount.encryptedData)).to.deep.equal(
        encryptedData
      );
      expect(healthRecordAccount.mimeType).to.equal('PDF');
      expect(healthRecordAccount.description).to.equal(
      expect(healthRecordAccount.mimeType).to.equal('PDF');
      expect(healthRecordAccount.description).to.equal(
        'Test health record'
      );
      expect(healthRecordAccount.accessList).to.have.length(0);

      const userVaultAccount = await program.account.userVault.fetch(userVault);
      expect(userVaultAccount.recordIds).to.have.length(1);
      expect(userVaultAccount.recordIds[0].toNumber()).to.equal(1);

      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      expect(recordCounterAccount.recordId.toNumber()).to.equal(2);
    });
  });

  describe('Grant Access', () => {
    let healthRecord: PublicKey;
    let recordId: anchor.BN;
  
    before(async () => {
      // Get current record counter to determine the next record ID
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const currentRecordId = recordCounterAccount.recordId;
      const recordIdBuf = new anchor.BN(currentRecordId).toArrayLike(Buffer, 'le', 8);
      [healthRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from('health_record'), owner.publicKey.toBuffer(), recordIdBuf],
        program.programId
      );

      const encryptedData = Buffer.from([1, 2, 3, 4, 5]);
      const fileType = 'PDF'
      const fileSize = new anchor.BN(1024)
      const description = 'Test health record for access'
      const title = "report"

      try {
        await program.account.healthRecord.fetch(healthRecord);
        console.log("Health record already exists. Skipping upload.");
      } catch {
        const res = await program.methods
          .uploadHealthRecord(encryptedData, fileType, fileSize, description, title)
          .accountsStrict({
            userVault,
            recordCounter,
            healthRecord,
            owner: owner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        console.log(`Health record uploaded successfully with ID: ${recordId.toString()}`);
      }

    });
  
    it('Should grant access to an organization', async () => {
      const tx = await program.methods
        .grantAccess(recordId, organization)
        .accountsStrict({
          healthRecord,
          organization,
          owner: owner.publicKey,
        })
        .rpc();
  
      console.log('Grant access transaction signature:', tx);
  
      const healthRecordAccount = await program.account.healthRecord.fetch(
        healthRecord
      );
      
      // Check that access was granted
      expect(healthRecordAccount.accessList).to.have.length.greaterThan(0);
  
      // Find the access permission for our organization
      const accessPermission = healthRecordAccount.accessList.find(
        access => access.organization.toString() === organization.toString()
      );
      
      expect(accessPermission).to.not.be.undefined;
      expect(accessPermission.organization.toString()).to.equal(
        organization.toString()
      );
      expect(accessPermission.grantedAt.toNumber()).to.be.greaterThan(0);
    });
  
    it('Should grant permanent access to another organization', async () => {
      const organizationOwner2 = Keypair.generate();
      await provider.connection.requestAirdrop(
        organizationOwner2.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
  
      const [organization2] = PublicKey.findProgramAddressSync(
        [Buffer.from('organization'), organizationOwner2.publicKey.toBuffer()],
        program.programId
      );
  
      // Register the second organization
      await program.methods
        .registerOrganization('Test Clinic 2', 'info@testclinic2.com')
        .accountsStrict({
          organization: organization2,
          owner: organizationOwner2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([organizationOwner2])
        .rpc();
  
      console.log('Second organization registered.');
  
      // Grant access to the second organization
      const tx = await program.methods
        .grantAccess(recordId, organization2)
        .accountsStrict({
          healthRecord,
          organization: organization2,
          owner: owner.publicKey,
        })
        .rpc();
  
      console.log('Grant permanent access transaction signature:', tx);
  
      const healthRecordAccount = await program.account.healthRecord.fetch(
        healthRecord
      );
      
      // Should have at least 2 organizations with access
      expect(healthRecordAccount.accessList).to.have.length.greaterThan(1);
  
      // Find the access permission for the second organization
      const accessPermission = healthRecordAccount.accessList.find(
        access => access.organization.toString() === organization2.toString()
      );
      
      expect(accessPermission).to.not.be.undefined;
      expect(accessPermission.organization.toString()).to.equal(
        organization2.toString()
      );
    });
  
    it('Should fail to grant access to same organization twice', async () => {
      try {
        await program.methods
          .grantAccess(recordId, organization)
          .accountsStrict({
            healthRecord,
            organization,
            owner: owner.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('AccessAlreadyGranted');
        console.log('Successfully caught duplicate access grant error:', error.message);
      }
    });
  
    it('Should fail to grant access to deactivated record', async () => {
      // Get current record counter to create a new record for deactivation test
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const deactivationTestRecordId = recordCounterAccount.recordId;
  
      const [deactivationTestRecord] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('health_record'),
          owner.publicKey.toBuffer(),
          Buffer.from(deactivationTestRecordId.toArrayLike(Buffer, 'le', 8)),
        ],
        program.programId
      );
  
      // Create a new record for deactivation test
      const mimeType = 'PDF';
      const fileSize = new anchor.BN(1024);
      const description = 'Test health record for deactivation';
      const title = "deactivation-test-record";
      const encryptedData = Buffer.from([1, 2, 3, 4, 5]);
  
      await program.methods
        .uploadHealthRecord(encryptedData, mimeType, fileSize, description, title)
        .accountsStrict({
          userVault,
          recordCounter,
          healthRecord: deactivationTestRecord,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
  
      console.log(`New health record for deactivation test uploaded with ID: ${deactivationTestRecordId.toString()}`);
  
      // Deactivate the record
      await program.methods
        .deactivateRecord(deactivationTestRecordId)
        .accountsStrict({
          userVault,
          healthRecord: deactivationTestRecord,
          owner: owner.publicKey,
        })
        .rpc();
  
      console.log('Health record deactivated for testing.');
  
      // Try to grant access to the deactivated record
      try {
        await program.methods
          .grantAccess(deactivationTestRecordId, organization)
          .accountsStrict({
            healthRecord: deactivationTestRecord,
            organization,
            owner: owner.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('AccessAlreadyGranted.');
      }
    });
  });

  describe('Revoke Access', () => {
    let healthRecord: PublicKey;
    const  mimeType = 'PDF';
    const  fileSize = new anchor.BN(1024);
    const  description = 'Test health record';
    const title = "test-record"

    before(async () => {
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const currentRecordId = recordCounterAccount.recordId;

      [healthRecord] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('health_record'),
          owner.publicKey.toBuffer(),
          Buffer.from(currentRecordId.toArrayLike(Buffer, 'le', 8)),
        ],
        program.programId
      );

      const encryptedData = Buffer.from([1, 2, 3, 4, 5]);
      const fileType = 'PDF'
      const fileSize = new anchor.BN(1024)
      const description = 'Test health record for revoke'
      const title = "Report"


      await program.methods
        .uploadHealthRecord(encryptedData, fileType, fileSize, description, title)
        .accountsStrict({
          userVault,
          recordCounter,
          healthRecord,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .grantAccess(currentRecordId, organization)
        .accountsStrict({
          healthRecord,
          organization,
          owner: owner.publicKey,
        })
        .rpc();
    });

    it('Should revoke access from an organization', async () => {
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const recordId = recordCounterAccount.recordId.sub(new anchor.BN(1));

      const tx = await program.methods
        .revokeAccess(recordId, organization)
        .accountsStrict({
          healthRecord,
          owner: owner.publicKey,
        })
        .rpc();

      console.log('Revoke access transaction signature:', tx);

      const healthRecordAccount = await program.account.healthRecord.fetch(
        healthRecord
      );

      expect(healthRecordAccount.accessList.length).to.equal(0);
    });

    it('Should fail to revoke access from organization without access', async () => {
      const organization2 = Keypair.generate();
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const recordId = recordCounterAccount.recordId.sub(new anchor.BN(1));

      try {
        await program.methods
          .revokeAccess(recordId, organization2.publicKey)
          .accountsStrict({
            healthRecord,
            owner: owner.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('AccessNotFound');
      }
    });
  });

  describe('Update User Vault', () => {
    it('Should update user vault status', async () => {
      const tx = await program.methods
        .updateUserVault(false)
        .accountsStrict({
          userVault,
          owner: owner.publicKey,
        })
        .rpc();

      console.log('Update user vault transaction signature:', tx);

      const userVaultAccount = await program.account.userVault.fetch(userVault);
      expect(userVaultAccount.isActive).to.be.false;

      await program.methods
        .updateUserVault(true)
        .accountsStrict({
          userVault,
          owner: owner.publicKey,
        })
        .rpc();

      const reactivatedAccount = await program.account.userVault.fetch(
        userVault
      );
      expect(reactivatedAccount.isActive).to.be.true;
    });
  });

});
