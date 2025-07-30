import React, {useCallback, useEffect, useState} from 'react';
import LinearGradient from 'react-native-linear-gradient';
import theme from '../util/theme';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import {NavBar} from '../components/NavBar';
import RecordCard, {RecordType} from '../components/RecordCard';
import {useAuthorization} from '../components/providers/AuthorizationProvider';
import {useNavigation} from '../components/providers/NavigationProvider';
import {useConnection} from '../components/providers/ConnectionProvider';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {getOrganization, Organization} from '../api/organization';
import {ERR_UNKNOWN, PROGRAM_ID} from '../util/constants';
import {Buffer} from 'buffer';
import {useToast} from '../components/providers/ToastContext';
import {sha256} from 'js-sha256';
import bs58 from 'bs58';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

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

export function encodeAnchorString(str: string): Buffer {
  const strBuf = Buffer.from(str, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBuf.length, 0);
  return Buffer.concat([lenBuf, strBuf]);
}

const RecordsScreen = () => {
  const {selectedAccount, deauthorizeSession} = useAuthorization();
  const {selectedRole} = useNavigation();
  const {connection} = useConnection();

  const toast = useToast();
  const {navigate, goBack, reset} = useNavigation();

  const [publicKey, setPublicKey] = useState<PublicKey>();
  useEffect(() => {
    setPublicKey(selectedAccount?.publicKey);
  }, [selectedAccount]);

  const isUser = selectedRole === 'user';
  const isOrg = selectedRole === 'organization';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  const [organization, setOrganization] = useState<Organization | undefined>(
    undefined,
  );
  const [registeredOrganization, setRegisteredOrganization] =
    useState<boolean>(false);
  const [records, setRecords] = useState<RecordType[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<RecordType[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userRecordsCount, setUserRecordCount] = useState<number>(0);
  const [sharedRecordsCount, setSharedRecordsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [accessListLength, setaccessListLength] = useState<number>(0);

  // Filter records based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRecords(records);
    } else {
      const filtered = records.filter(
        record =>
          record.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          record.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          record.mimeType.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredRecords(filtered);
    }
  }, [records, searchQuery]);

  const fetchOrganization = async () => {
    if (!publicKey) {
      console.log('Wallet not connected. Pubkey not found!');
      return;
    }
    try {
      console.log('fetching organization');
      setLoading(true);
      const result = await getOrganization(connection, publicKey);
      if (result && result.name.length > 0) {
        setOrganization(result);
        setLoading(true);

        await getOrganizationRecords(result.recordIds);
      } else {
        setLoading(false);
      }
      console.log('successfull fetched1');
    } catch (error: any) {
      if (error && error.message === 'Organization account not found') {
        setLoading(false);
      } else {
        toast.show({type: 'error', message: error?.message || ERR_UNKNOWN});
      }
    } finally {
      console.log('successfull fetched2');
      setLoading(false);
    }
  };

  const getOrganizationRecords = async (accessRecords: string[]) => {
    const recordIdSet = new Set(accessRecords);
    const discriminator = getDiscriminator('HealthRecord');
    setLoading(false);
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

        if (!recordIdSet.has(record_id.toString())) {
          continue;
        }

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
        setLoading(false);
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
      setLoading(true);
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
      setLoading(false);
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
      await deleteRecordTransaction(recordId);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
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

          const discriminator = Buffer.from(
            sha256.digest('global:deactivate_record'),
          ).slice(0, 8);

          const instructionData = Buffer.concat([
            discriminator,
            recordIdBuffer,
          ]);

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

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <LinearGradient
      colors={theme.colors.backgroundGradient}
      style={styles.container}>
      <NavBar />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search records..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.searchIcon}>
          <Text style={styles.searchIconText}>🔍</Text>
        </View>
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results Info */}
      {searchQuery.length > 0 && (
        <View style={styles.searchInfoContainer}>
          <Text style={styles.searchInfoText}>
            Found {filteredRecords.length} record(s) matching "{searchQuery}"
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        {loading ? (
          <View>
            <ActivityIndicator
              style={styles.loading}
              size="large"
              color="#fff"
            />
            <Text style={styles.loadingText}>Please wait...</Text>
          </View>
        ) : (
          filteredRecords.map((record, index) => (
            <RecordCard
              key={index}
              record={record}
              onDelete={handleDeleteRecord}
            />
          ))
        )}

        {filteredRecords.length === 0 &&
          !loading &&
          searchQuery.length === 0 && (
            <View style={styles.noRecords}>
              <Text style={styles.noRecordsText}>No Records Found</Text>
            </View>
          )}

        {filteredRecords.length === 0 && !loading && searchQuery.length > 0 && (
          <View style={styles.noRecords}>
            <Text style={styles.noRecordsText}>
              No records match your search criteria
            </Text>
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={clearSearch}>
              <Text style={styles.clearSearchButtonText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

export default RecordsScreen;

const styles = StyleSheet.create({
  container: {flex: 1},
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.textPrimary || '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingLeft: 45,
    paddingRight: 45,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme.colors.textPrimary || '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchInfoContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchInfoText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  scrollView: {
    padding: 16,
  },
  loading: {
    flex: 1,
    marginTop: 70,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    justifyContent: 'center',
    textAlign: 'center',
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  noRecords: {
    flex: 1,
    marginTop: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noRecordsText: {
    fontSize: 16,
    marginTop: 16,
    justifyContent: 'center',
    textAlign: 'center',
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  clearSearchButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  clearSearchButtonText: {
    color: theme.colors.textPrimary || '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
