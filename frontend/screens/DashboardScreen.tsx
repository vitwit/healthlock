import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useAuthorization} from '../components/providers/AuthorizationProvider';
import {useNavigation} from '../components/providers/NavigationProvider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useConnection} from '../components/providers/ConnectionProvider';
import {PublicKey} from '@solana/web3.js';
import {sha256} from 'js-sha256';
import {ERR_UNKNOWN, PROGRAM_ID, TEE_STATE} from '../util/constants';
import RecordCard, {RecordType} from '../components/RecordCard';
import bs58 from 'bs58';
import {
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {getOrganization, Organization} from '../api/organization';
import {useToast} from '../components/providers/ToastContext';
import {parseTEEState} from '../api/state';
import {useTEEContext} from '../components/providers/TEEStateProvider';

export function encodeAnchorString(str: string): Buffer {
  const strBuf = Buffer.from(str, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBuf.length, 0);
  return Buffer.concat([lenBuf, strBuf]);
}

const DashboardScreen = () => {
  const {selectedAccount} = useAuthorization();
  const {selectedRole} = useNavigation();

  console.log("account -----", selectedAccount?.publicKey.toBase58());

  const isUser = selectedRole === 'user';
  const isOrg = selectedRole === 'organization';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  const {navigate, goBack} = useNavigation();
  const {connection} = useConnection();
  const {accounts} = useAuthorization();

  const [publicKey, setPublicKey] = useState<PublicKey>();
  useEffect(() => {
    if (accounts && accounts?.length > 0) {
      const p = accounts[0].publicKey;
      setPublicKey(p);
      setPublicKey(selectedAccount?.publicKey);
    }
  }, [accounts]);

  const toast = useToast();

  const getTEEStatePDA = (): PublicKey => {
    const [teeStatePDA] = PublicKey.findProgramAddressSync(
      [TEE_STATE],
      PROGRAM_ID,
    );
    return teeStatePDA;
  };

  const {teeState, setTEEState} = useTEEContext();

  const fetchTEEState = async () => {
    try {
      const globalStatePDA = getTEEStatePDA();
      const accountInfo = await connection.getAccountInfo(globalStatePDA);
      console.log(accountInfo);

      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{dataSize: 1073}],
      });

      for (const account of accounts) {
        const parsed = parseTEEState(account.account.data);
        console.log('Parsed TEE Node:', parsed);
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
    }
  };

  useEffect(() => {
    if (!teeState)
      fetchTEEState()
        .then(res => console.log('res =========>', res))
        .catch(err => console.log('errr =======> ', err));
  }, []);

  const [organizationLoading, setOrganizationLoading] =
    useState<boolean>(false);
  const [organization, setOrganization] = useState<Organization | undefined>(
    undefined,
  );
  const [registeredOrganization, setRegisteredOrganization] =
    useState<boolean>(false);

  const fetchOrganization = async () => {
    try {
      setOrganizationLoading(true);
      const result = await getOrganization(connection, publicKey);
      if (result && result.name.length > 0) {
        setOrganization(result);
        setRegisteredOrganization(true);
      } else {
        setRegisteredOrganization(false);
      }
    } catch (error: any) {
      if (error && error.message === 'Organization account not found') {
        setRegisteredOrganization(false);
      } else {
        toast.show({type: 'error', message: error?.message || ERR_UNKNOWN});
      }
    } finally {
      setOrganizationLoading(false);
    }
  };

  useEffect(() => {
    if (isOrg) if (!publicKey) return;
    fetchOrganization();
  }, [isOrg, publicKey]);

  const [records, setRecords] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  function getDiscriminator(name: string): Buffer {
    const hash = sha256.digest(`account:${name}`);
    return Buffer.from(hash).slice(0, 8);
  }

  useEffect(() => {
    const fetchRecords = async () => {
      console.log('🔍 Fetching records...');
      if (!publicKey) {
        console.log('inside');
        return;
      }

      setLoading(true);

      try {
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
                offset: 8, // After discriminator, owner pubkey starts
                bytes: publicKey.toBase58(),
              },
            },
          ],
        });

        console.log('✅ Accounts found:', accounts.length);

        const parsedRecords: RecordType[] = [];

        setRecords([
          {
            accessGrantedTo: 10,
            createdAt: 1753008850,
            description: ' CBP report Vijaya Diagnostics',
            id: '1',
            title: 'CBP Report',
          },
          {
            accessGrantedTo: 10,
            createdAt: 1753008850,
            description: ' CBP report Vijaya Diagnostics',
            id: '6',
            title: 'CBP Report',
          },
          {
            accessGrantedTo: 10,
            createdAt: 1753008850,
            description: ' CBP report Vijaya Diagnostics',
            id: '2',
            title: 'CBP Report',
          },
          {
            accessGrantedTo: 10,
            createdAt: 1753008850,
            description: ' CBP report Vijaya Diagnostics',
            id: '3',
            title: 'CBP Report',
          },
          {
            accessGrantedTo: 10,
            createdAt: 1753008850,
            description: ' CBP report Vijaya Diagnostics',
            id: '4',
            title: 'CBP Report',
          },
          {
            accessGrantedTo: 10,
            createdAt: 1753008850,
            description: ' CBP report Vijaya Diagnostics',
            id: '5',
            title: 'CBP Report',
          },
        ]);

        for (const acc of accounts) {
          const data = acc.account.data;
          const totalLength = data.length;
          let offset = 8; // Skip discriminator

          try {
            console.log('📦 Record buffer length:', totalLength);

            const owner = new PublicKey(data.slice(offset, offset + 32));
            console.log('👤 Owner:', owner.toBase58());
            offset += 32;

            const record_id = Number(data.readBigUInt64LE(offset));
            console.log('🔢 Record ID:', record_id);
            offset += 8;

            // Skip encrypted_data
            const encLen = data.readUInt32LE(offset);
            offset += 4;
            offset += encLen;

            // Access list
            let accessListLen = 0;
            const accessListStart = offset;

            try {
              accessListLen = data.readUInt32LE(offset);
              offset += 4;

              const expectedAccessSize = accessListLen * (32 + 8);
              if (offset + expectedAccessSize > totalLength) {
                console.warn('⚠️ Skipping corrupt access list');
                offset = accessListStart + 4; // Only skip the length field
                accessListLen = 0;
              } else {
                offset += expectedAccessSize;
              }
            } catch (e) {
              console.warn('⚠️ Failed to read access list — skipping');
              offset = accessListStart + 4;
              accessListLen = 0;
            }

            // mime_type
            const mimeLen = data.readUInt32LE(offset);
            offset += 4;
            offset += mimeLen;

            // file_size
            const fileSize = Number(data.readBigUInt64LE(offset));
            offset += 8;

            // created_at
            const createdAt = Number(data.readBigInt64LE(offset));
            offset += 8;

            // title
            const titleLen = data.readUInt32LE(offset);
            offset += 4;
            if (offset + titleLen > totalLength) {
              console.log(
                '📏 titleLen =',
                titleLen,
                '| remaining =',
                totalLength - offset,
              );
              throw new Error('Title exceeds buffer');
            }
            const title = data
              .slice(offset, offset + titleLen)
              .toString('utf-8');
            offset += titleLen;

            // description
            const descLen = data.readUInt32LE(offset);
            offset += 4;
            if (offset + descLen > totalLength) {
              console.log(
                '📏 descLen =',
                descLen,
                '| remaining =',
                totalLength - offset,
              );
              throw new Error('Description exceeds buffer');
            }
            const description = data
              .slice(offset, offset + descLen)
              .toString('utf-8');
            offset += descLen;

            parsedRecords.push({
              id: `REC${record_id}`,
              title,
              description,
              createdAt,
              accessGrantedTo: accessListLen,
            });
          } catch (err) {
            console.error('❌ Failed to parse a record:', err?.message);
          }
        }

        console.log('📃 Parsed records:', parsedRecords);
        // setRecords(parsedRecords);
      } catch (err) {
        console.error('Failed to fetch health records:', err);
      } finally {
        console.log('🔁 Done loading');
        setLoading(false);
      }
    };

    fetchRecords();
  }, [publicKey]);

  const {authorizeSession} = useAuthorization();

  const registerOrganizationTransaction = useCallback(
    async (name: string, contactInfo: string) => {
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
    try {
      setRegisterOrganizationLoading(true);
      await registerOrganizationTransaction(name, contactInfo);
      await fetchOrganization();
    } catch (err: any) {
    } finally {
      setRegisterOrganizationLoading(false);
    }
  };

  const renderItem = ({item}: {item: RecordType}) => (
    <RecordCard record={item} navigate={navigate} />
  );

  return (
    <LinearGradient
      colors={['#001F3F', '#003366', '#001F3F']}
      style={styles.container}>
      <View style={styles.wrapper}>
        <Text style={styles.heading}>
          {isUser ? 'Your Records' : 'Organization Dashboard'}
        </Text>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {isUser ? (
            <>
              <StatCard title="Total Records" value={10} icon="folder" />
              <StatCard title="Shared with Orgs" value={10} icon="share" />
            </>
          ) : (
            <>
              {registeredOrganization ? (
                <>
                  <StatCard
                    title="Records Accessed"
                    value={5}
                    icon="visibility"
                  />
                </>
              ) : (
                <View style={styles.registrationForm}>
                  <Text style={styles.formHeading}>
                    Your organization is not registered. Please create an
                    account to continue using the application.
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
            </>
          )}
        </View>

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

        {/* Record List */}
        {(isUser || (registeredOrganization && isOrg)) && (
          <ScrollView>
            <View style={styles.listContainer}>
              <Text style={styles.sectionHeading}>Records</Text>
              <FlatList
                contentContainerStyle={styles.listContainer}
                data={records}
                keyExtractor={item => item.id}
                renderItem={renderItem}
              />
            </View>
          </ScrollView>
        )}
      </View>
    </LinearGradient>
  );
};

const StatCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) => (
  <View style={styles.statCard}>
    <Icon name={icon} size={30} color="#fff" />
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f5f5f5ff',
    marginBottom: 24,
    textAlign: 'center',
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
    marginBottom: 20,
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
});

export default DashboardScreen;
