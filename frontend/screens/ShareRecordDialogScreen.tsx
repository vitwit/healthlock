import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../components/providers/NavigationProvider';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useToast } from '../components/providers/ToastContext';
import { useAuthorization } from '../components/providers/AuthorizationProvider';
import { sha256 } from 'js-sha256';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '../components/providers/ConnectionProvider';
import bs58 from 'bs58';
import { Transaction, TransactionInstruction } from '@solana/web3.js';
import { PROGRAM_ID } from '../util/constants';
import { RecordType } from '../components/RecordCard';

type OrganizationType = {
  owner: PublicKey;
  organization_id: number;
  name: string;
  contact_info: string;
  created_at: number;
  description: string;
  record_ids: number[];
};

const ShareRecordDialogScreen = () => {
  const toast = useToast();
  const { selectedAccount } = useAuthorization();
  const { connection } = useConnection();
  const [records, setRecords] = useState<RecordType[]>([]);
  const [organizationsWithAccess, setOrganizationsWithAccess] = useState<
    string[]
  >([]);
  const { goBack, currentParams } = useNavigation();
  const { authorizeSession } = useAuthorization();
  const [organizations, setOrganizations] = useState<OrganizationType[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<{ [key: string]: boolean }>({
    org1: true,
    org2: false,
    org3: false,
  });
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState<string | null>(null);
  const [revokeAccessLoading, setRevokeAccessLoading] = useState<string | null>(
    null,
  );
  const { accounts } = useAuthorization();
  const [publicKey, setPublicKey] = useState<PublicKey>();

  useEffect(() => {
    if (accounts && accounts?.length > 0) {
      const p = accounts[0].publicKey;
      setPublicKey(p);
      setPublicKey(selectedAccount?.publicKey);
    }
  }, [accounts]);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoading(true);
        const fetchedOrgs = await fetchAllOrganizations();

        const transformedOrgs: OrganizationType[] = fetchedOrgs.map(org => ({
          organization_id: org.organization_id,
          description: org.description,
          owner: org.owner,
          name: org.name,
          record_ids: org.record_ids,
          contact_info: org.contact_info,
          created_at: org.created_at,
        }));

        setOrganizations(transformedOrgs);

        const initialSelection: Record<string, boolean> = {};
        transformedOrgs.forEach(org => {
          initialSelection[org.owner.toBase58()] = false;
        });
        setSelectedOrgs(initialSelection);
      } catch (error) {
        console.error('Failed to load organizations:', error);
        toast.show({
          type: 'error',
          message: 'Failed to load organizations',
        });
      } finally {
        setLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  const toggleOrg = (id: string) => {
    setSelectedOrgs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const organizationDiscriminator = Buffer.from(
    sha256.digest('account:Organization'),
  ).slice(0, 8);

  const deserializeOrganization = (data: Buffer): OrganizationType => {
    let offset = 0;

    const owner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const organization_id_buffer = data.slice(offset, offset + 8);
    const organization_id = Number(organization_id_buffer.readBigUInt64LE(0));
    offset += 8;

    const nameLength = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLength).toString('utf8');
    offset += nameLength;

    const contactLength = data.readUInt32LE(offset);
    offset += 4;
    const contact_info = data
      .slice(offset, offset + contactLength)
      .toString('utf8');
    offset += contactLength;

    const created_at_buffer = data.slice(offset, offset + 8);
    const created_at = Number(created_at_buffer.readBigInt64LE(0));
    offset += 8;

    const descLength = data.readUInt32LE(offset);
    offset += 4;
    const description = data
      .slice(offset, offset + descLength)
      .toString('utf8');
    offset += descLength;

    const recordIdsLength = data.readUInt32LE(offset);
    offset += 4;
    const record_ids = [];
    for (let i = 0; i < recordIdsLength; i++) {
      const recordId = Number(
        data.slice(offset, offset + 8).readBigUInt64LE(0),
      );
      record_ids.push(recordId);
      offset += 8;
    }

    return {
      owner,
      organization_id,
      name,
      contact_info,
      created_at,
      description,
      record_ids,
    };
  };

  const fetchAllOrganizations = async (): Promise<OrganizationType[]> => {
    try {
      console.log('Fetching all organizations...');

      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: bs58.encode(organizationDiscriminator),
            },
          },
        ],
      });

      console.log(`Found ${accounts.length} organization accounts`);

      const organizations = accounts
        .map(({ account }) => {
          try {
            const data = account.data.slice(8);

            const organization = deserializeOrganization(data);
            // organization.owner = pubkey;

            return organization;
          } catch (error) {
            console.error('Error deserializing organization:', error);
            return null;
          }
        })
        .filter(org => org !== null);

      return organizations;
    } catch (error) {
      console.error('Error fetching organizations:', error);
      throw error;
    }
  };

  const confirmTransactionWithPolling = async (
    txid: string,
    commitment = 'confirmed',
    timeout = 60000,
  ) => {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const status = await connection.getSignatureStatus(txid);
        console.log('polling...');
        if (
          status?.value?.confirmationStatus === commitment ||
          status?.value?.confirmationStatus === 'finalized'
        ) {
          return status.value;
        }

        if (status?.value?.err) {
          throw new Error(
            `Transaction failed: ${JSON.stringify(status.value.err)}`,
          );
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log('Polling error:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  function parseUserVault(data: Buffer) {
    let offset = 8;

    const owner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const recordIdsLen = data.readUInt32LE(offset);
    offset += 4;

    const record_ids = [];
    for (let i = 0; i < recordIdsLen; i++) {
      const recordId = Number(data.readBigUInt64LE(offset));
      record_ids.push(recordId);
      offset += 8;
    }

    return {
      owner,
      record_ids,
    };
  }

  function getDiscriminator(name: string): Buffer {
    const hash = sha256.digest(`account:${name}`);
    return Buffer.from(hash).slice(0, 8);
  }

  const fetchRecords = async () => {
    if (!publicKey) {
      return;
    }
    setLoading(true);

    try {
      const [userVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_vault'), publicKey.toBuffer()],
        PROGRAM_ID,
      );

      const userVaultAccount = await connection.getAccountInfo(userVaultPda);
      if (!userVaultAccount) {
        console.log('User vault not found');
        setRecords([]);
        return;
      }

      const userVault = parseUserVault(userVaultAccount.data);
      const activeRecordIds = userVault.record_ids;

      if (activeRecordIds.length === 0) {
        setRecords([]);
        return;
      }

      const discriminator = getDiscriminator('HealthRecord');

      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: bs58.encode(discriminator),
            },
          },
          {
            memcmp: {
              offset: 8,
              bytes: publicKey.toBase58(),
            },
          },
        ],
      });

      console.log('✅ Accounts found:', accounts.length);

      const parsedRecords: RecordType[] = [];

      for (const acc of accounts) {
        const data = acc.account.data;
        const totalLength = data.length;
        let offset = 8;

        try {
          console.log('📦 Record buffer length:', totalLength);

          const owner = new PublicKey(data.slice(offset, offset + 32));
          console.log('👤 Owner:', owner.toBase58());
          offset += 32;

          const record_id = Number(data.readBigUInt64LE(offset));
          offset += 8;

          if (!activeRecordIds.includes(record_id)) {
            continue;
          }

          const encLen = data.readUInt32LE(offset);
          offset += 4;
          if (offset + encLen > totalLength) {
            throw new Error('Encrypted data exceeds buffer');
          }
          const encryptedData = data
            .slice(offset, offset + encLen)
            .toString('utf-8');
          offset += encLen;

          const createdAt = Number(data.readBigInt64LE(offset));
          offset += 8;

          let accessListLen = 0;
          const accessListStart = offset;
          try {
            accessListLen = data.readUInt32LE(offset);
            offset += 4;

            const expectedAccessSize = accessListLen * (32 + 8);
            if (offset + expectedAccessSize > totalLength) {
              console.warn('⚠️ Skipping corrupt access list');
              offset = accessListStart + 4;
              accessListLen = 0;
            } else {
              offset += expectedAccessSize;
            }
          } catch (e) {
            console.warn('⚠️ Failed to read access list — skipping');
            offset = accessListStart + 4;
            accessListLen = 0;
          }

          const mimeLen = data.readUInt32LE(offset);
          offset += 4;
          const mimeType = data.slice(offset, offset + mimeLen).toString('utf-8');
          offset += mimeLen;

          offset += 8;

          const descLen = data.readUInt32LE(offset);
          offset += 4;
          if (offset + descLen > totalLength) {
            throw new Error('Description exceeds buffer');
          }
          const description = data
            .slice(offset, offset + descLen)
            .toString('utf-8');
          offset += descLen;

          const titleLen = data.readUInt32LE(offset);
          offset += 4;
          if (offset + titleLen > totalLength) {
            throw new Error('Title exceeds buffer');
          }
          const title = data.slice(offset, offset + titleLen).toString('utf-8');
          offset += titleLen;

          console.log('✅ Parsed Record:', {
            id: `REC${record_id}`,
            title,
            description,
            encryptedData,
            createdAt,
            accessGrantedTo: accessListLen,
          });

          parsedRecords.push({
            id: record_id,
            title,
            description,
            encryptedData,
            createdAt,
            accessGrantedTo: accessListLen,
            owner: owner.toBase58(),
            mimeType: mimeType,
          });
        } catch (err: any) {
          console.error('❌ Failed to parse a record:', err?.message);
        }
      }

      console.log('📃 Parsed records:', parsedRecords);
      setRecords(parsedRecords);
    } catch (err) {
      console.error('Failed to fetch health records:', err);
    } finally {
      console.log('🔁 Done loading');
      setLoading(false);
    }
  };

  const revokeAccessTransaction = useCallback(
    async (recordId: number, organizationPublicKey: PublicKey) => {
      return await transact(async (wallet: Web3MobileWallet) => {
        try {
          const [authorizationResult, latestBlockhash] = await Promise.all([
            authorizeSession(wallet),
            connection.getLatestBlockhash(),
          ]);

          const userPubkey = authorizationResult.publicKey;

          // Convert record ID to numeric format
          const numericRecordId = recordId;
          const recordIdBuffer = Buffer.alloc(8);
          recordIdBuffer.writeBigUInt64LE(BigInt(numericRecordId), 0);

          // Find health record PDA
          const [healthRecordPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('health_record'),
              userPubkey.toBuffer(),
              recordIdBuffer,
            ],
            PROGRAM_ID,
          );

          // Find organization PDA todo
          const [organizationPDA] = await PublicKey.findProgramAddress(
            [Buffer.from('organization'), organizationPublicKey.toBuffer()],
            PROGRAM_ID,
          );

          // Create discriminator for revoke_access function
          const discriminator = Buffer.from(
            sha256.digest('global:revoke_access'),
          ).slice(0, 8);

          // Create instruction data
          const instructionData = Buffer.concat([
            discriminator,
            recordIdBuffer,
            organizationPublicKey.toBuffer(),
          ]);

          // Define account keys
          const keys = [
            { pubkey: healthRecordPda, isSigner: false, isWritable: true },
            { pubkey: organizationPDA, isSigner: false, isWritable: true },
            { pubkey: userPubkey, isSigner: true, isWritable: true },
          ];

          // Create transaction instruction
          const instruction = new TransactionInstruction({
            keys,
            programId: PROGRAM_ID,
            data: instructionData,
          });

          // Create and configure transaction
          const transaction = new Transaction({
            ...latestBlockhash,
            feePayer: userPubkey,
          });

          transaction.add(instruction);

          // Sign and send transaction
          const signedTxs = await wallet.signTransactions({
            transactions: [transaction],
          });

          const txid = await connection.sendRawTransaction(
            signedTxs[0].serialize(),
            {
              skipPreflight: false,
              preflightCommitment: 'processed',
            },
          );

          await connection.confirmTransaction(txid, 'confirmed');

          toast.show({
            type: 'success',
            message: 'Access revoked successfully!',
          });

          return signedTxs[0];
        } catch (error: any) {
          console.error('Revoke access transaction error:', error);

          let errorMessage = 'Failed to revoke access';
          if (error.message?.includes('UnauthorizedAccess')) {
            errorMessage = 'You are not authorized to revoke access';
          } else if (error.message?.includes('AccessNotFound')) {
            errorMessage = 'Access not found for this organization';
          } else if (error.message?.includes('InvalidOrganization')) {
            errorMessage = 'Invalid organization';
          } else if (error.message?.includes('RecordNotFoundInOrganization')) {
            errorMessage = 'Record not found in organization';
          } else if (error.message) {
            errorMessage = error.message;
          }

          toast.show({
            type: 'error',
            message: errorMessage,
          });

          throw error;
        }
      });
    },
    [authorizeSession, connection, toast],
  );

  const shareRecordTransaction = useCallback(
    async (recordId: string, selectedOrganizations: OrganizationType[]) => {
      return await transact(async (wallet: Web3MobileWallet) => {
        try {
          const [authorizationResult, latestBlockhash] = await Promise.all([
            authorizeSession(wallet),
            connection.getLatestBlockhash(),
          ]);

          const userPubkey = authorizationResult.publicKey;

          const numericRecordId = recordId;
          const recordIdBuffer = Buffer.alloc(8);
          recordIdBuffer.writeBigUInt64LE(BigInt(numericRecordId), 0);

          const [healthRecordPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('health_record'),
              userPubkey.toBuffer(),
              recordIdBuffer,
            ],
            PROGRAM_ID,
          );

          const discriminator = Buffer.from(
            sha256.digest('global:grant_access'),
          ).slice(0, 8);

          const transaction = new Transaction({
            ...latestBlockhash,
            feePayer: userPubkey,
          });

          for (const organization of selectedOrganizations) {
            const [organizationPDA] = await PublicKey.findProgramAddress(
              [Buffer.from('organization'), organization.owner.toBuffer()],
              PROGRAM_ID,
            );
            const instructionData = Buffer.concat([
              discriminator,
              recordIdBuffer,
              organization.owner.toBuffer(),
            ]);

            const keys = [
              { pubkey: healthRecordPda, isSigner: false, isWritable: true },
              { pubkey: organizationPDA, isSigner: false, isWritable: true },
              { pubkey: userPubkey, isSigner: true, isWritable: true },
            ];

            const instruction = new TransactionInstruction({
              keys,
              programId: PROGRAM_ID,
              data: instructionData,
            });

            transaction.add(instruction);
          }

          const signedTxs = await wallet.signTransactions({
            transactions: [transaction],
          });

          const txid = await connection.sendRawTransaction(
            signedTxs[0].serialize(),
            {
              skipPreflight: false,
              preflightCommitment: 'processed',
            },
          );

          await connection.confirmTransaction(txid, 'confirmed');

          toast.show({
            type: 'success',
            message: `Record shared with ${selectedOrganizations.length} organization(s) successfully!`,
          });

          await fetchRecords();
          return signedTxs[0];
        } catch (error: any) {
          console.error(
            'Grant access to organization transaction error:',
            error,
          );

          let errorMessage = 'Failed to grant access';
          if (error.message?.includes('UnauthorizedAccess')) {
            errorMessage = 'You are not authorized to grant access';
          } else if (error.message) {
            errorMessage = error.message;
          }

          toast.show({
            type: 'error',
            message: errorMessage,
          });

          throw error;
        }
      });
    },
    [authorizeSession, connection, toast],
  );

  const handleRevokeAccess = async (organizationPublicKey: PublicKey) => {
    try {
      const recordId = currentParams?.record?.id;

      if (!recordId) {
        toast.show({
          type: 'error',
          message: 'No record ID found',
        });
        return;
      }

      setRevokeAccessLoading(recordId);

      await revokeAccessTransaction(recordId, organizationPublicKey);

      // Optionally update local state to remove the organization from selected orgs
      setSelectedOrgs(prev => {
        const updated = { ...prev };
        delete updated[organizationPublicKey.toBase58()];
        return updated;
      });

      goBack();
    } catch (error) {
      console.error('Handle revoke access error:', error);
      toast.show({
        type: 'error',
        message: 'Failed to revoke access',
      });
    } finally {
      setRevokeAccessLoading(null);
    }
  };

  const handleShare = async () => {
    const recordId = currentParams?.record?.id;
    const selectedOrgList = organizations.filter(
      org => selectedOrgs[org.owner.toBase58()],
    );
    console.log(
      'Sharing with:',
      selectedOrgList.map(o => o.name),
    );

    try {
      setShareLoading(recordId);
      await shareRecordTransaction(recordId, selectedOrgList);

      const newOrgIds = selectedOrgList.map(org => org.owner.toBase58());
      setOrganizationsWithAccess(prev => {
        const combined = [...prev, ...newOrgIds];
        return [...new Set(combined)]; // Remove duplicates
      });
      setSelectedOrgs({});

      goBack();
    } catch (error) {
      console.log('Sharing failed:', error);
    } finally {
      setShareLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#001F3F', '#003366', '#001F3F']}
        style={styles.gradient}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Icon name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Share Health Record</Text>
        </View>

        {/* Record Info */}
        <View style={styles.recordBox}>
          <Text style={styles.recordTitle}>{currentParams?.record?.title}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.orgList}>
          {organizations.map((org, index) => (
            <View key={org.owner.toBase58() ?? index} style={styles.orgRow}>
              <TouchableOpacity
                style={styles.orgInfo}
                onPress={() => toggleOrg(org.owner.toBase58())}>
                <Icon
                  name={
                    selectedOrgs[org.owner.toBase58()]
                      ? 'check-box'
                      : 'check-box-outline-blank'
                  }
                  size={22}
                  color="white"
                  style={styles.checkbox}
                />
                <View>
                  <Text style={styles.orgName}>{org.name}</Text>
                  <Text style={styles.orgType}>{org.description}</Text>
                </View>
              </TouchableOpacity>
              {org.record_ids?.includes(currentParams?.record?.id) && (
                <TouchableOpacity
                  style={styles.revokeButton}
                  onPress={() => handleRevokeAccess(org.owner)}>
                  <Icon name="remove-circle-outline" size={20} color="red" />
                  <Text style={styles.revokeButtonText}>Revoke</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Share Button */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => {
            handleShare();
          }}>
          <Text style={styles.shareButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 10,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  recordBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
  },
  recordTitle: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  orgList: {
    paddingBottom: 20,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 8
  },
  orgInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 10,
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  orgName: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  orgType: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#004080',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  revokeButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revokeButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // revokeButton: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   gap: 4, // or use marginLeft if gap not supported
  // },
});

export default ShareRecordDialogScreen;
