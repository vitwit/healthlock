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
  let organizationCounter: PublicKey;
  let userVault: PublicKey;
  let organization: PublicKey;
  let organizationId: number;

  before(async () => {
    [recordCounter] = PublicKey.findProgramAddressSync(
      [Buffer.from('record_counter')],
      program.programId
    );

    [organizationCounter] = PublicKey.findProgramAddressSync(
      [Buffer.from('organization_counter')],
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
      expect(organizationAccount.organizationId.toNumber()).to.equal(
        organizationId
      );
      expect(organizationAccount.name).to.equal('Test Hospital');
      expect(organizationAccount.contactInfo).to.equal(
        'contact@testhospital.com'
      );
      expect(organizationAccount.createdAt.toNumber()).to.be.greaterThan(0);
    });
  });

  describe('Register User', () => {
    it('Should register a new user', async () => {
      const tx = await program.methods
        .registerUser()
        .accountsStrict({
          userVault: userVault,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Register user transaction signature:', tx);

      const userVaultAccount = await program.account.userVault.fetch(userVault);
      expect(userVaultAccount.owner.toString()).to.equal(
        owner.publicKey.toString()
      );
      expect(userVaultAccount.isActive).to.be.true;
      expect(userVaultAccount.recordIds).to.have.length(0);
      expect(userVaultAccount.createdAt.toNumber()).to.be.greaterThan(0);
    });

    it('Should fail to register user again', async () => {
      try {
        await program.methods
          .registerUser()
          .accountsStrict({
            userVault,
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

  describe('Upload Health Record', () => {
    let healthRecord: PublicKey;

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
    });

    it('Should upload a health record', async () => {
      const encryptedData = Buffer.from([1, 2, 3, 4, 5]);
      const metadata = {
        fileType: 'PDF',
        fileSize: new anchor.BN(1024),
        description: 'Test health record',
        createdAt: new anchor.BN(Date.now() / 1000),
      };

      const tx = await program.methods
        .uploadHealthRecord(encryptedData, metadata)
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
      expect(healthRecordAccount.metadata.fileType).to.equal('PDF');
      expect(healthRecordAccount.metadata.description).to.equal(
        'Test health record'
      );
      expect(healthRecordAccount.isActive).to.be.true;
      expect(healthRecordAccount.accessList).to.have.length(0);

      const userVaultAccount = await program.account.userVault.fetch(userVault);
      expect(userVaultAccount.recordIds).to.have.length(1);
      expect(userVaultAccount.recordIds[0].toNumber()).to.equal(1);

      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      expect(recordCounterAccount.recordId.toNumber()).to.equal(2);
    });

    it('Should fail to upload with description too long', async () => {
      const encryptedData = Buffer.from([1, 2, 3, 4, 5]);
      const metadata = {
        fileType: 'PDF',
        fileSize: new anchor.BN(1024),
        description: 'A'.repeat(101),
        createdAt: new anchor.BN(Date.now() / 1000),
      };

      try {
        await program.methods
          .uploadHealthRecord(encryptedData, metadata)
          .accountsStrict({
            userVault,
            recordCounter,
            healthRecord,
            owner: owner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('DescriptionTooLong');
      }
    });

    it('Should fail to upload with deactivated vault', async () => {
      await program.methods
        .updateUserVault(false)
        .accountsStrict({
          userVault,
          owner: owner.publicKey,
        })
        .rpc();

      const encryptedData = Buffer.from([1, 2, 3, 4, 5]);
      const metadata = {
        fileType: 'PDF',
        fileSize: new anchor.BN(1024),
        description: 'Test health record',
        createdAt: new anchor.BN(Date.now() / 1000),
      };

      try {
        await program.methods
          .uploadHealthRecord(encryptedData, metadata)
          .accountsStrict({
            userVault,
            recordCounter,
            healthRecord,
            owner: owner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('VaultDeactivated');
      }

      await program.methods
        .updateUserVault(true)
        .accountsStrict({
          userVault,
          owner: owner.publicKey,
        })
        .rpc();
    });
  });

  describe('Grant Access', () => {
    let healthRecord: PublicKey;

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
      const metadata = {
        fileType: 'PDF',
        fileSize: new anchor.BN(1024),
        description: 'Test health record for access',
        createdAt: new anchor.BN(Date.now() / 1000),
      };

      await program.methods
        .uploadHealthRecord(encryptedData, metadata)
        .accountsStrict({
          userVault,
          recordCounter,
          healthRecord,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it('Should grant access to an organization', async () => {
      const accessDuration = new anchor.BN(86400);
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const recordId = recordCounterAccount.recordId.sub(new anchor.BN(1));

      const tx = await program.methods
        .grantAccess(recordId, organization, accessDuration)
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
      expect(healthRecordAccount.accessList).to.have.length(1);

      const accessPermission = healthRecordAccount.accessList[0];
      expect(accessPermission.organization.toString()).to.equal(
        organization.toString()
      );
      expect(accessPermission.isActive).to.be.true;
      expect(accessPermission.expiresAt).to.not.be.null;
      expect(accessPermission.grantedAt.toNumber()).to.be.greaterThan(0);
    });

    it('Should grant permanent access (no expiration)', async () => {
      const organizationOwner2 = Keypair.generate();
      await provider.connection.requestAirdrop(
        organizationOwner2.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const organizationCounterAccount =
        await program.account.organizationCounter.fetch(organizationCounter);
      const currentOrgId = organizationCounterAccount.organizationId.toNumber();

      const [organization2] = PublicKey.findProgramAddressSync(
        [Buffer.from('organization'), organizationOwner2.publicKey.toBuffer()],
        program.programId
      );

      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const recordId = recordCounterAccount.recordId.sub(new anchor.BN(1));

      await program.methods
        .registerOrganization('Test Clinic 2', 'info@testclinic2.com')
        .accountsStrict({
          organizationCounter: organizationCounter,
          organization: organization2,
          owner: organizationOwner2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([organizationOwner2])
        .rpc();

      const tx = await program.methods
        .grantAccess(recordId, organization2, null)
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
      expect(healthRecordAccount.accessList).to.have.length(2);

      const accessPermission = healthRecordAccount.accessList[1];
      expect(accessPermission.organization.toString()).to.equal(
        organization2.toString()
      );
      expect(accessPermission.isActive).to.be.true;
      expect(accessPermission.expiresAt).to.be.null;
    });

    it('Should fail to grant access to same organization twice', async () => {
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const recordId = recordCounterAccount.recordId.sub(new anchor.BN(1));

      try {
        await program.methods
          .grantAccess(recordId, organization, new anchor.BN(86400))
          .accountsStrict({
            healthRecord,
            organization,
            owner: owner.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('AccessAlreadyGranted');
      }
    });

    it('Should fail to grant access to deactivated record', async () => {
      const recordCounterAccount = await program.account.recordCounter.fetch(
        recordCounter
      );
      const recordId = recordCounterAccount.recordId.sub(new anchor.BN(1));

      await program.methods
        .deactivateRecord(recordId)
        .accountsStrict({
          userVault,
          healthRecord,
          owner: owner.publicKey,
        })
        .rpc();

      try {
        await program.methods
          .grantAccess(recordId, organization, new anchor.BN(86400))
          .accountsStrict({
            healthRecord,
            organization,
            owner: owner.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('RecordDeactivated');
      }
    });
  });

  describe('Revoke Access', () => {
    let healthRecord: PublicKey;

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
      const metadata = {
        fileType: 'PDF',
        fileSize: new anchor.BN(1024),
        description: 'Test health record for revoke',
        createdAt: new anchor.BN(Date.now() / 1000),
      };

      await program.methods
        .uploadHealthRecord(encryptedData, metadata)
        .accountsStrict({
          userVault,
          recordCounter,
          healthRecord,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .grantAccess(currentRecordId, organization, new anchor.BN(86400))
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
      expect(healthRecordAccount.accessList).to.have.length(1);

      const accessPermission = healthRecordAccount.accessList[0];
      expect(accessPermission.organization.toString()).to.equal(
        organization.toString()
      );
      expect(accessPermission.isActive).to.be.false;
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
