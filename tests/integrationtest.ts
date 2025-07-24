import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Healthlock } from '../target/types/healthlock';

describe("Health Records Complete Flow Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Healthlock as Program<Healthlock>; // Replace with your actual program name
  
  it("Should complete the entire flow: init counter, register org, upload 4 records, grant access to first 3", async () => {
    const userKeypair = Keypair.generate();
    const organizationOwnerKeypair = Keypair.generate();
    const organization2OwnerKeypair = Keypair.generate();
    const teeNodeKeypair = Keypair.generate();

    
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(userKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );
    
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(organizationOwnerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(organization2OwnerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(teeNodeKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );

    const [recordCounterPda, recordCounterBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("record_counter")],
      program.programId
    );

    const [organizationPda, organizationBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("organization"), organizationOwnerKeypair.publicKey.toBuffer()],
      program.programId
    );

    const [organization2Pda, organization2Bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("organization"), organization2OwnerKeypair.publicKey.toBuffer()],
      program.programId
    );

    const [teeStatePda, teeStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), teeNodeKeypair.publicKey.toBuffer()],
      program.programId
    );

    const [userVaultPda, userVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_vault"), userKeypair.publicKey.toBuffer()],
      program.programId
    );

    // Health record PDAs (for record IDs 1-4)
    const [healthRecord1Pda, healthRecord1Bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("health_record"), userKeypair.publicKey.toBuffer(), Buffer.from([1, 0, 0, 0, 0, 0, 0, 0])],
      program.programId
    );

    const [healthRecord2Pda, healthRecord2Bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("health_record"), userKeypair.publicKey.toBuffer(), Buffer.from([2, 0, 0, 0, 0, 0, 0, 0])],
      program.programId
    );

    const [healthRecord3Pda, healthRecord3Bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("health_record"), userKeypair.publicKey.toBuffer(), Buffer.from([3, 0, 0, 0, 0, 0, 0, 0])],
      program.programId
    );

    const [healthRecord4Pda, healthRecord4Bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("health_record"), userKeypair.publicKey.toBuffer(), Buffer.from([4, 0, 0, 0, 0, 0, 0, 0])],
      program.programId
    );

    console.log("Step 1: Initializing record counter...");
    const initCounterTx = await program.methods
      .initializeRecordCounter()
      .accountsStrict({
        recordCounter: recordCounterPda,
        owner: userKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    console.log("Initialize record counter transaction signature:", initCounterTx);

    const recordCounterAccount = await program.account.recordCounter.fetch(recordCounterPda);
    assert.equal(recordCounterAccount.recordId.toNumber(), 1);
    console.log("✓ Record counter initialized with ID:", recordCounterAccount.recordId.toNumber());

    console.log("\nStep 2: Registering organization...");
    const organizationName = "Test Healthcare Organization";
    const contactInfo = "contact@testhealthcare.com";

    const registerOrgTx = await program.methods
      .registerOrganization(organizationName, contactInfo)
      .accountsStrict({
        organization: organizationPda,
        owner: organizationOwnerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([organizationOwnerKeypair])
      .rpc();

    console.log("Register organization transaction signature:", registerOrgTx);

    // Verify the organization was registered
    const organizationAccount = await program.account.organization.fetch(organizationPda);
    assert.equal(organizationAccount.name, organizationName);
    assert.equal(organizationAccount.contactInfo, contactInfo);
    assert.equal(organizationAccount.owner.toString(), organizationOwnerKeypair.publicKey.toString());
    console.log("✓ Organization registered:", organizationAccount.name);

    console.log("\nRegistering organization2...");
    const organization2Name = "Test Healthcare Organization2";
    const contact2Info = "contact2@testhealthcare.com";

    const registerOrg2Tx = await program.methods
      .registerOrganization(organization2Name, contact2Info)
      .accountsStrict({
        organization: organization2Pda,
        owner: organization2OwnerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([organization2OwnerKeypair])
      .rpc();

    console.log("Register organization2 transaction signature:", registerOrg2Tx);

    // Verify the organization2 was registered
    const organization2Account = await program.account.organization.fetch(organization2Pda);
    assert.equal(organization2Account.name, organization2Name);
    assert.equal(organization2Account.contactInfo, contact2Info);
    assert.equal(organization2Account.owner.toString(), organization2OwnerKeypair.publicKey.toString());
    console.log("✓ Organization2 registered:", organization2Account.name);

    console.log("\nStep 3: Registering TEE node...");
    // Mock TEE node public key and attestation data
    const teeNodePubkey = Buffer.from(teeNodeKeypair.publicKey.toBytes());
    const teeNodeAttestation = Buffer.from("mock_attestation_data_for_tee_node_verification");

    const registerTEETx = await program.methods
      .registerTee(teeNodePubkey, teeNodeAttestation)
      .accountsStrict({
        state: teeStatePda,
        signer: teeNodeKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([teeNodeKeypair])
      .rpc();

    console.log("Register TEE node transaction signature:", registerTEETx);

    // Verify the TEE node was registered
    const teeStateAccount = await program.account.teeState.fetch(teeStatePda);
    assert.equal(teeStateAccount.signer.toString(), teeNodeKeypair.publicKey.toString());
    assert.equal(teeStateAccount.isInitialized, true);
    console.log("✓ TEE node registered with signer:", teeStateAccount.signer.toString());


    // STEP 3: Upload 4 health records
    console.log("\nStep 4: Uploading 4 health records...");
    const healthRecords = [
      {
        title: "Blood Test Results",
        description: "Complete blood count and lipid panel",
        mimeType: "application/pdf",
        encryptedData: "encrypted_blood_test_data_1",
        fileSize: 1024,
        pda: healthRecord1Pda,
      },
      {
        title: "X-Ray Report",
        description: "Chest X-ray examination",
        mimeType: "image/jpeg",
        encryptedData:"encrypted_xray_data_2",
        fileSize: 2048,
        pda: healthRecord2Pda,
      },
      {
        title: "Prescription Records",
        description: "Current medication list",
        mimeType: "application/pdf",
        encryptedData:"encrypted_prescription_data_3",
        fileSize: 512,
        pda: healthRecord3Pda,
      },
      {
        title: "MRI Scan",
        description: "Brain MRI examination",
        mimeType: "image/dicom",
        encryptedData:'adhookati',
        fileSize: 4096,
        pda: healthRecord4Pda,
      },
    ];

    for (let i = 0; i < healthRecords.length; i++) {
      const record = healthRecords[i];
      
      const uploadTx = await program.methods
        .uploadHealthRecord(
          record.encryptedData,
          record.mimeType,
          new anchor.BN(record.fileSize),
          record.description,
          record.title
        )
        .accountsStrict({
          userVault: userVaultPda,
          recordCounter: recordCounterPda,
          healthRecord: record.pda,
          owner: userKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([userKeypair])
        .rpc();

      console.log(`Upload health record ${i + 1} transaction signature:`, uploadTx);

      const healthRecordAccount = await program.account.healthRecord.fetch(record.pda);
      assert.equal(healthRecordAccount.title, record.title);
      assert.equal(healthRecordAccount.description, record.description);
      assert.equal(healthRecordAccount.mimeType, record.mimeType);
      assert.equal(healthRecordAccount.fileSize.toNumber(), record.fileSize);
      assert.equal(healthRecordAccount.owner.toString(), userKeypair.publicKey.toString());
      assert.equal(healthRecordAccount.recordId.toNumber(), i + 1);
      console.log(`✓ Health record ${i + 1} uploaded: ${record.title}`);
    }

    const userVaultAccount = await program.account.userVault.fetch(userVaultPda);
    assert.equal(userVaultAccount.recordIds.length, 4);
    assert.equal(userVaultAccount.owner.toString(), userKeypair.publicKey.toString());
    assert.equal(userVaultAccount.isActive, true);
    console.log("✓ User vault contains all 4 record IDs:", userVaultAccount.recordIds.map(id => id.toNumber()));

    const updatedRecordCounterAccount = await program.account.recordCounter.fetch(recordCounterPda);
    assert.equal(updatedRecordCounterAccount.recordId.toNumber(), 5);
    console.log("✓ Record counter incremented to:", updatedRecordCounterAccount.recordId.toNumber());

    console.log("\nStep 4: Granting organization access to first 3 records...");
    const recordsToGrantAccess = [
      { recordId: 1, pda: healthRecord1Pda },
      { recordId: 2, pda: healthRecord2Pda },
      { recordId: 3, pda: healthRecord3Pda },
    ];

    for (const record of recordsToGrantAccess) {
      const grantAccessTx = await program.methods
        .grantAccess(new anchor.BN(record.recordId), organizationPda)
        .accountsStrict({
          healthRecord: record.pda,
          organization: organizationPda,
          owner: userKeypair.publicKey,
        })
        .signers([userKeypair])
        .rpc();

      console.log(`Grant access for record ${record.recordId} transaction signature:`, grantAccessTx);

      const healthRecordAccount = await program.account.healthRecord.fetch(record.pda);
      assert.equal(healthRecordAccount.accessList.length, 1);
      assert.equal(healthRecordAccount.accessList[0].organization.toString(), organizationPda.toString());
      assert.isTrue(healthRecordAccount.accessList[0].grantedAt.toNumber() > 0);
      console.log(`✓ Access granted to organization for record ${record.recordId}`);
    }

    const healthRecord4Account = await program.account.healthRecord.fetch(healthRecord4Pda);
    assert.equal(healthRecord4Account.accessList.length, 0);
    console.log("✓ Record 4 has no access granted (as expected)");

  
    console.log("\n=== Final State Verification ===");
    
    const finalRecordCounterAccount = await program.account.recordCounter.fetch(recordCounterPda);
    const finalOrganizationAccount = await program.account.organization.fetch(organizationPda);
    const finalUserVaultAccount = await program.account.userVault.fetch(userVaultPda);
    
    console.log("Record Counter ID:", finalRecordCounterAccount.recordId.toNumber());
    console.log("Organization Name:", finalOrganizationAccount.name);
    console.log("User Vault Record IDs:", finalUserVaultAccount.recordIds.map(id => id.toNumber()));
    
    // Check access permissions for all records
    const healthRecordPdas = [healthRecord1Pda, healthRecord2Pda, healthRecord3Pda, healthRecord4Pda];
    for (let i = 0; i < healthRecordPdas.length; i++) {
      const healthRecordAccount = await program.account.healthRecord.fetch(healthRecordPdas[i]);
      console.log(`Record ${i + 1} (${healthRecordAccount.title}): ${healthRecordAccount.accessList.length} access permission(s)`);
    }

    assert.equal(finalRecordCounterAccount.recordId.toNumber(), 5);
    assert.equal(finalUserVaultAccount.recordIds.length, 4);
    
    const record1Account = await program.account.healthRecord.fetch(healthRecord1Pda);
    const record2Account = await program.account.healthRecord.fetch(healthRecord2Pda);
    const record3Account = await program.account.healthRecord.fetch(healthRecord3Pda);
    const record4Account = await program.account.healthRecord.fetch(healthRecord4Pda);
    
    assert.equal(record1Account.accessList.length, 1);
    assert.equal(record2Account.accessList.length, 1);
    assert.equal(record3Account.accessList.length, 1);
    assert.equal(record4Account.accessList.length, 0);


    console.log("\n=== Fetching all the health records of a user ===");
    const userHealthRecordsFiltered = await program.account.healthRecord.all([
      {
        memcmp: {
          offset: 8,
          bytes: userKeypair.publicKey.toBase58(),
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


    console.log("\n=== Fetching all the registered  organisations ===");
    const allOrganizations = await program.account.organization.all();
    
    console.log(`\nTotal organizations registered: ${allOrganizations.length}`);
    
    console.log("\n🏥 All Registered Organizations:");
    console.log("==================================");
    allOrganizations.forEach((org, index) => {
      console.log(`\norganizations list ${JSON.stringify(org)}:`);
    });
    
    console.log("\n🎉 All tests passed! Complete flow executed successfully:");
  });
});