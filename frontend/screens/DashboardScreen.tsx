import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl, // Add this import
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useAuthorization} from '../components/providers/AuthorizationProvider';
import {useNavigation} from '../components/providers/NavigationProvider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useConnection} from '../components/providers/ConnectionProvider';
import {PublicKey} from '@solana/web3.js';
import {sha256} from 'js-sha256';
import {ERR_UNKNOWN, PROGRAM_ID} from '../util/constants';
import RecordCard, {RecordType} from '../components/RecordCard';
import bs58 from 'bs58';
import {
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {getOrganization, Organization} from '../api/organization';
import {useToast} from '../components/providers/ToastContext';
import {parseTEEState} from '../api/state';
import {useTEEContext} from '../components/providers/TEEStateProvider';
import ProfileCard from '../components/ProfileCard';
import {shortenAddress} from '../util/address';
import OrganizationRecordCard from '../components/OrganiaztionRecordCard';

export function encodeAnchorString(str: string): Buffer {
  const strBuf = Buffer.from(str, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBuf.length, 0);
  return Buffer.concat([lenBuf, strBuf]);
}

const DashboardScreen = () => {
  const {selectedAccount, deauthorizeSession} = useAuthorization();
  const {selectedRole} = useNavigation();

  console.log('address>>>>>>>>>>>>>>.', selectedAccount?.publicKey.toBase58());

  const isUser = selectedRole === 'user';
  const isOrg = selectedRole === 'organization';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [organizationLoading, setOrganizationLoading] =
    useState<boolean>(false);
  const [organization, setOrganization] = useState<Organization | undefined>(
    undefined,
  );
  const [registeredOrganization, setRegisteredOrganization] =
    useState<boolean>(false);
  const [records, setRecords] = useState<RecordType[]>([]);
  const [userRecordsCount, setUserRecordCount] = useState<number>(0);
  const [sharedRecordsCount, setSharedRecordsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [userRecordsLoading, setUserRecordsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false); // Add refresh state

  const {navigate, goBack, reset} = useNavigation();
  const {connection} = useConnection();
  const [accessListLength, setaccessListLength] = useState<number>(0);

  const [publicKey, setPublicKey] = useState<PublicKey>();
  useEffect(() => {
    setPublicKey(selectedAccount?.publicKey);
  }, [selectedAccount]);

  const toast = useToast();

  const {teeState, setTEEState} = useTEEContext();

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

  const fetchTEEState = async () => {
    try {
      setLoading(true);
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{dataSize: 1073}],
      });

      for (const account of accounts) {
        const parsed = parseTEEState(account.account.data);
        setTEEState({
          attestation: parsed.attestation,
          isInitialized: parsed.isInitialized,
          pubkey: parsed.pubkey,
          signer: parsed.signer,
        });
      }
    } catch (err: any) {
      if (err.message) {
        toast.show({
          message: err.message,
          type: 'error',
        });
      } else {
        toast.show({
          message: ERR_UNKNOWN,
          type: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!teeState) fetchTEEState();
  }, []);

  function getDiscriminator(name: string): Buffer {
    const hash = sha256.digest(`account:${name}`);
    return Buffer.from(hash).slice(0, 8);
  }

  const [organizationRecordsLoading, setOrganizationRecordsLoading] =
    useState<boolean>(false);

  const fetchOrganization = async () => {
    if (!publicKey) {
      console.log('Wallet not connected. Pubkey not found!');
      return;
    }
    try {
      console.log('fetching organization');
      setOrganizationLoading(true);
      const result = await getOrganization(connection, publicKey);
      if (result && result.name.length > 0) {
        setOrganization(result);
        setRegisteredOrganization(true);

        await getOrganizationRecords(result.recordIds);
      } else {
        setRegisteredOrganization(false);
      }
      console.log(result);
    } catch (error: any) {
      if (error && error.message === 'Organization account not found') {
        setRegisteredOrganization(false);
      } else {
        toast.show({type: 'error', message: error?.message || ERR_UNKNOWN});
      }
    } finally {
      console.log('successfull fetched2');
      setOrganizationLoading(false);
    }
  };

  const getOrganizationRecords = async (accessRecords: string[]) => {
    const recordIdSet = new Set(accessRecords);
    const discriminator = getDiscriminator('HealthRecord');
    setOrganizationRecordsLoading(false);
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(discriminator),
          },
        },
      ],
    });

    const parsedRecords: RecordType[] = [];

    for (const acc of accounts) {
      const data = acc.account.data;
      const totalLength = data.length;
      let offset = 8;

      try {
        const owner = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        const record_id = Number(data.readBigUInt64LE(offset));
        offset += 8;

        // Check if this record_id is listed in organization's recordIds
        if (!recordIdSet.has(record_id.toString())) {
          continue;
        }

        // Check if the record is active in the owner's vault
        const [userVaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('user_vault'), owner.toBuffer()],
          PROGRAM_ID,
        );

        const userVaultAccount = await connection.getAccountInfo(userVaultPda);
        if (!userVaultAccount) {
          continue;
        }

        const userVault = parseUserVault(userVaultAccount.data);
        const activeRecordIds = userVault.record_ids;

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

        // Skip access list parsing entirely
        let accessListLen = 0;
        const accessListStart = offset;
        try {
          accessListLen = data.readUInt32LE(offset);
          offset += 4;

          const expectedAccessSize = accessListLen * (32 + 8);
          if (offset + expectedAccessSize > totalLength) {
            offset = accessListStart + 4;
            accessListLen = 0;
          } else {
            offset += expectedAccessSize;
          }
        } catch (e) {
          offset = accessListStart + 4;
          accessListLen = 0;
        }

        const mimeLen = data.readUInt32LE(offset);
        offset += 4;
        if (offset + mimeLen > totalLength) {
          throw new Error('Meme string exceeds buffer');
        }

        const mimeType = data.slice(offset, offset + mimeLen).toString('utf-8');

        offset += mimeLen;

        const fileSize = Number(data.readBigUInt64LE(offset));
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
        console.error(
          '❌ Failed to parse an organization record:',
          err?.message,
        );
      } finally {
        setOrganizationRecordsLoading(false);
      }

      setaccessListLength(parsedRecords.length);
      setRecords(parsedRecords);
    }
  };

  useEffect(() => {
    if (isOrg) {
      if (!publicKey) return;
      fetchOrganization();
    }
  }, [isOrg, publicKey]);

  const fetchUserRecords = async () => {
    if (isOrg) {
      return;
    }

    console.log('🔍 Fetching records...');
    if (!publicKey) {
      console.log('inside');
      return;
    }

    try {
      setUserRecordsLoading(true);
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

          const mimeType = data
            .slice(offset, offset + mimeLen)
            .toString('utf-8');

          offset += mimeLen;

          const fileSize = Number(data.readBigUInt64LE(offset));
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
      setUserRecordCount(parsedRecords.length);

      const total = parsedRecords.reduce(
        (t, item) => t + item.accessGrantedTo,
        0,
      );
      setSharedRecordsCount(total);
    } catch (err) {
      console.error('Failed to fetch health records:', err);
    } finally {
      console.log('🔁 Done loading');
      setUserRecordsLoading(false);
    }
  };

  useEffect(() => {
    if (isUser) {
      fetchUserRecords();
    }
  }, [publicKey, isUser]);

  // Add refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isUser) {
        await fetchUserRecords();
      } else if (isOrg) {
        await fetchOrganization();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [isUser, isOrg, registeredOrganization]);

  const {authorizeSession} = useAuthorization();

  const registerOrganizationTransaction = useCallback(
    async (name: string, description: string, contactInfo: string) => {
      return await transact(async (wallet: Web3MobileWallet) => {
        try {
          const [authorizationResult, latestBlockhash] = await Promise.all([
            authorizeSession(wallet),
            connection.getLatestBlockhash(),
          ]);

          const userPubkey = authorizationResult.publicKey;

          const [organizationPDA] = await PublicKey.findProgramAddress(
            [Buffer.from('organization'), userPubkey.toBuffer()],
            PROGRAM_ID,
          );

          const discriminator = Buffer.from([
            183, 29, 228, 76, 94, 9, 196, 137,
          ]);

          const data = Buffer.concat([
            discriminator,
            encodeAnchorString(name),
            encodeAnchorString(description),
            encodeAnchorString(contactInfo),
          ]);
          const keys = [
            {pubkey: organizationPDA, isSigner: false, isWritable: true},
            {pubkey: userPubkey, isSigner: true, isWritable: true},
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ];

          const ix = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys,
            data,
          });

          const tx = new Transaction({
            ...latestBlockhash,
            feePayer: userPubkey,
          });

          tx.add(ix);

          const signedTxs = await wallet.signTransactions({transactions: [tx]});
          const txid = await connection.sendRawTransaction(
            signedTxs[0].serialize(),
          );

          // await confirmTransactionWithPolling(txid, 'confirmed');
          await connection.confirmTransaction(txid, 'confirmed');

          toast.show({
            type: 'success',
            message: `Successfully registered`,
          });

          return signedTxs[0];
        } catch (error: any) {
          if (error && error.message) {
            toast.show({
              type: 'error',
              message: error.message,
            });
          } else if (error.response) {
            toast.show({
              type: 'error',
              message: JSON.stringify(error.response),
            });
          } else {
            toast.show({
              type: 'error',
              message: ERR_UNKNOWN,
            });
          }
        }
      });
    },
    [authorizeSession, connection],
  );

  const [registerOrganizationLoading, setRegisterOrganizationLoading] =
    useState<boolean>(false);

  const onClickRegisterOrg = async () => {
    if (
      name.trim().length <= 3 ||
      description.trim().length <= 3 ||
      contactInfo.trim().length <= 3
    ) {
      toast.show({
        message: 'Invalid input data',
        type: 'error',
      });
      return;
    }
    try {
      setRegisterOrganizationLoading(true);
      await registerOrganizationTransaction(
        name.trim(),
        description.trim(),
        contactInfo.trim(),
      );
      await fetchOrganization();
    } catch (err: any) {
    } finally {
      setRegisterOrganizationLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId: number) => {
    try {
      setDeleteLoading(recordId);
      await deleteRecordTransaction(recordId);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleteLoading(null);
    }
  };

  const confirmTransactionWithPolling = async (
    txid: string,
    commitment = 'confirmed',
    timeout = 30000,
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

  const handleDisconnect = () => {
    const f = async () => {
      try {
        await transact(async wallet => {
          deauthorizeSession(wallet);
        });
        reset('ConnectWallet');
      } catch (err: any) {}
    };

    f();
  };

  const deleteRecordTransaction = useCallback(
    async (recordId: number) => {
      return await transact(async (wallet: Web3MobileWallet) => {
        try {
          const [authorizationResult, latestBlockhash] = await Promise.all([
            authorizeSession(wallet),
            connection.getLatestBlockhash(),
          ]);

          const userPubkey = authorizationResult.publicKey;

          const recordIdBuffer = Buffer.alloc(8);
          recordIdBuffer.writeBigUInt64LE(BigInt(recordId), 0);

          const [userVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('user_vault'), userPubkey.toBuffer()],
            PROGRAM_ID,
          );

          const [healthRecordPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('health_record'),
              userPubkey.toBuffer(),
              recordIdBuffer,
            ],
            PROGRAM_ID,
          );

          // Fixed discriminator calculation
          const discriminator = Buffer.from(
            sha256.digest('global:deactivate_record'),
          ).slice(0, 8);

          const instructionData = Buffer.concat([
            discriminator,
            recordIdBuffer, // This is the _record_id parameter
          ]);

          // Accounts must match the order in your Rust struct
          const keys = [
            {pubkey: userVaultPda, isSigner: false, isWritable: true},
            {pubkey: healthRecordPda, isSigner: false, isWritable: true},
            {pubkey: userPubkey, isSigner: true, isWritable: true},
          ];

          const instruction = new TransactionInstruction({
            keys,
            programId: PROGRAM_ID,
            data: instructionData,
          });

          const transaction = new Transaction({
            ...latestBlockhash,
            feePayer: userPubkey,
          });

          transaction.add(instruction);

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

          // await confirmTransactionWithPolling(txid, 'confirmed');
          await connection.confirmTransaction(txid, 'confirmed');

          toast.show({
            type: 'success',
            message: 'Record deleted successfully!',
          });

          await fetchUserRecords();

          return signedTxs[0];
        } catch (error: any) {
          console.error('Delete record transaction error:', error);

          let errorMessage = 'Failed to delete record';
          if (error.message?.includes('UnauthorizedAccess')) {
            errorMessage = 'You are not authorized to delete this record';
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

  const renderItem = (item: RecordType) => (
    <RecordCard record={item} onDelete={handleDeleteRecord} key={item.id} />
  );

  const renderOrganizationItem = (item: RecordType) => (
    <OrganizationRecordCard
      record={item}
      navigate={navigate}
      onDelete={handleDeleteRecord}
      key={item.id}
    />
  );

  return (
    <LinearGradient
      colors={['#001F3F', '#003366', '#001F3F']}
      style={styles.container}>
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>HealthLock</Text>
        <Icon
          name="logout"
          size={22}
          color="#fff"
          onPress={handleDisconnect} // define this function
        />
      </View>
      {loading ? (
        <View>
          <ActivityIndicator style={styles.loading} size="large" color="#fff" />
          <Text style={styles.loadingText}>Please wait...</Text>
        </View>
      ) : (
        <View style={styles.wrapper}>
          {isOrg && !organizationLoading && !registeredOrganization && (
            <View style={styles.registrationForm}>
              <Text style={styles.formHeading}>
                Your organization is not registered. Please create an account to
                continue using the application.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="rgba(255,255,255,0.6)"
                maxLength={50}
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={styles.input}
                placeholder="Description"
                placeholderTextColor="rgba(255,255,255,0.6)"
                maxLength={100}
                value={description}
                onChangeText={setDescription}
              />
              <TextInput
                style={styles.input}
                multiline={true}
                numberOfLines={3}
                placeholder="Contact Info"
                placeholderTextColor="rgba(255,255,255,0.6)"
                maxLength={255}
                value={contactInfo}
                onChangeText={setContactInfo}
              />

              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => {
                  onClickRegisterOrg();
                }}>
                <Text style={styles.registerButtonText}>Register</Text>
              </TouchableOpacity>
            </View>
          )}
          {(isUser ||
            (isOrg && !organizationLoading && registeredOrganization)) && (
            <View>
              <ProfileCard
                isUser={isUser}
                name={
                  isUser
                    ? publicKey
                      ? shortenAddress(publicKey, 9)
                      : '-'
                    : organization?.name || '-'
                }
                description={!isUser ? organization?.description : null}
                contactInfo={!isUser ? organization?.contactInfo : null}
                stats={
                  isUser
                    ? [
                        {title: 'Total Records', value: userRecordsCount},
                        {title: 'Shared Records', value: sharedRecordsCount},
                      ]
                    : [{title: 'Accessible Records', value: accessListLength}]
                }
              />
            </View>
          )}

          {/* Action Button */}
          {isUser && (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => {
                navigate('Upload');
              }}>
              <Icon name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload New Record</Text>
            </TouchableOpacity>
          )}

          {/* Record List with RefreshControl */}
          {isUser && !userRecordsLoading && (
            <ScrollView
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#004080']} // Android
                  tintColor="#004080" // iOS
                  title="Pull to refresh" // iOS
                  titleColor="#fff" // iOS
                />
              }>
              <View style={styles.listContainer}>
                <Text style={styles.sectionHeading}>Records</Text>
                <View>{records.map(renderItem)}</View>
                <View>
                  {records.length === 0 && !userRecordsLoading && (
                    <Text
                      style={{
                        textAlign: 'center',
                        fontSize: 16,
                        color: '#fff',
                        marginTop: 16,
                      }}>
                      No Records Found
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
          {isOrg && !organizationRecordsLoading && registeredOrganization && (
            <ScrollView
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#004080']} // Android
                  tintColor="#004080" // iOS
                  title="Pull to refresh" // iOS
                  titleColor="#fff" // iOS
                />
              }>
              <View style={styles.listContainer}>
                <Text style={styles.sectionHeading}>Records</Text>
                <View>{records.map(renderOrganizationItem)}</View>
                <View>
                  {records.length === 0 && !organizationRecordsLoading && (
                    <Text
                      style={{
                        textAlign: 'center',
                        fontSize: 16,
                        color: '#fff',
                        marginTop: 16,
                      }}>
                      You don't have access to records
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  loading: {
    flex: 1,
    marginTop: 70,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 22,
    justifyContent: 'center',
    textAlign: 'center',
    fontWeight: '500',
    color: '#f5f5f5ff',
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f5f5f5ff',
    marginBottom: 24,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 6,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statTitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#004080',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  uploadButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
  listContainer: {
    flex: 1,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  recordItem: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    marginBottom: 10,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordTitle: {
    color: '#fff',
    fontSize: 16,
  },
  registrationForm: {
    flex: 1,
    padding: 20,
    borderRadius: 10,
    marginTop: 24,
  },
  formHeading: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  registerButton: {
    backgroundColor: '#004080',
    padding: 12,
    borderRadius: 8,
  },
  registerButtonText: {
    textAlign: 'center',
    color: '#fff',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginBottom: 12,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 22,
    paddingHorizontal: 22,
  },

  navTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default DashboardScreen;
