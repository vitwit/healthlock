import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { sha256 } from 'js-sha256';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { ERR_UNKNOWN, PROGRAM_ID, SOLANA_VALIDATOR } from '../util/constants';
import {
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { useToast } from '../components/providers/ToastContext';
import {
  Account,
  useAuthorization,
} from '../components/providers/AuthorizationProvider';
import { PublicKey } from '@solana/web3.js';
import { NavBar } from '../components/NavBar';
import { useConnection } from '../components/providers/ConnectionProvider';
import theme from '../util/theme';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { encodeAnchorString } from './DashboardScreen';
import { getUser, User } from '../api/user';

const ProfileScreen = () => {
  const toast = useToast();

  const { accounts, selectedAccount } = useAuthorization();
  const [pubkey, setPubKey] = useState<PublicKey | null>(null);
  const [name, setName] = useState('John Doe');
  const [age, setAge] = useState(30);
  const [modalVisible, setModalVisible] = useState(false);
  const [getSolLoading, setGetSolLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [updateUserLoading, setUpdateUserLoading] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const { authorizeSession } = useAuthorization();
  const [fetchUserLoading, setFetchUserLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const { connection } = useConnection();

  const [publicKey, setPublicKey] = useState<PublicKey>();
  useEffect(() => {
    setPublicKey(selectedAccount?.publicKey);
  }, [selectedAccount]);

  const getBalance = async () => {
    setBalanceLoading(true);
    if (!accounts) return;
    try {
      const balance = await connection.getBalance(accounts[0].publicKey);
      setBalance(balance);
    } catch (err: any) {
      toast.show({
        message: err.message || ERR_UNKNOWN,
        type: 'error',
      });
    } finally {
      setBalanceLoading(false);
    }
  };

  const [account, setAccount] = useState<Account | undefined>(undefined);
  useEffect(() => {
    if (!accounts) return;

    if (accounts?.length > 0) {
      setPubKey(accounts[0].publicKey);
      setAccount(accounts[0]);
      getBalance();
    }
  }, [accounts]);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAge(user.age);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setModalVisible(false);
    try {
      setUpdateUserLoading(true);
      await updateUserTransaction(name, age);
      Alert.alert('Profile Updated', `Name: ${name}, Age: ${age}`);
    } catch (error) {
      console.error('failed to update user profile: ', error);
      toast.show({
        type: 'error',
        message: 'Failed to update user profile',
      });
    } finally {
      setUpdateUserLoading(false);
    }
  };

  const fetchUser = async () => {
    if (!publicKey) {
      console.log('Wallet not connected. Pubkey not found!');
      return;
    }
    try {
      console.log('fetching user');
      setFetchUserLoading(true);
      const result = await getUser(connection, publicKey);
      if (result && result.name.length > 0) {
        setUser(result);
      } else {
        setFetchUserLoading(false);
      }
      console.log('successfull fetched user');
    } catch (error: any) {
      toast.show({ type: 'error', message: error?.message || ERR_UNKNOWN });
    } finally {
      console.log('successfull fetched2');
      setFetchUserLoading(false);
    }
  };

  const handleGetTokens = async () => {
    try {
      if (!pubkey) return;
      setGetSolLoading(true);
      await requestSolAirdrop(pubkey, 5_000_000_000);
      toast.show({ message: 'Airdrop received', type: 'success' });
      await getBalance();
    } catch (err: any) {
      toast.show({
        message: err?.message || JSON.stringify(err) || ERR_UNKNOWN,
        type: 'error',
      });
    } finally {
      setGetSolLoading(false);
    }
  };

  const updateUserTransaction = useCallback(
    async (name: string, age: number) => {
      return await transact(async (wallet: Web3MobileWallet) => {
        try {
          console.log('Parameters - Name:', name, 'Age:', age);

          const [authorizationResult, latestBlockhash] = await Promise.all([
            authorizeSession(wallet),
            connection.getLatestBlockhash(),
          ]);

          const userPubkey = authorizationResult.publicKey;

          // Derive user vault PDA
          const [userVaultPda, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from('user_vault'), userPubkey.toBuffer()],
            PROGRAM_ID,
          );

          const discriminator = Buffer.from(
            sha256.digest('global:update_user_vault'),
          ).slice(0, 8);

          const ageBuffer = Buffer.alloc(8);
          try {
            ageBuffer.writeBigUInt64LE(BigInt(age), 0);
          } catch (error) {
            console.log('writeBigUInt64LE failed, using fallback:', error);
            const user_age = Number(age);
            ageBuffer.writeUInt32LE(user_age & 0xffffffff, 0);
            ageBuffer.writeUInt32LE((user_age >>> 32) & 0xffffffff, 4);
          }

          const data = Buffer.concat([
            discriminator,
            ageBuffer,
            encodeAnchorString(name),
          ]);

          // Define accounts in correct order
          const accountKeys = [
            {
              pubkey: userVaultPda,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: userPubkey,
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ];

          // Create transaction instruction
          const instruction = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: accountKeys,
            data,
          });

          const transaction = new Transaction({
            ...latestBlockhash,
            feePayer: userPubkey,
          });
          transaction.add(instruction);

          // Sign transaction
          const signedTransactions = await wallet.signTransactions({
            transactions: [transaction],
          });

          const txid = await connection.sendRawTransaction(
            signedTransactions[0].serialize(),
          );

          // Confirm transaction with the same blockhash
          console.log('⏳ Confirming transaction...');
          await confirmTransactionWithPolling(txid, 'confirmed');

          toast.show({
            type: 'success',
            message: 'User profile updated successfully!',
          });

          await fetchUser();
          return signedTransactions[0];
        } catch (error: any) {
          console.error('❌ Update user transaction failed:', error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            logs: error.logs || 'No logs available',
          });

          // Enhanced error handling
          let errorMessage = 'Failed to update user profile';

          if (error.message) {
            if (error.message.includes('Blockhash not found')) {
              errorMessage =
                'Transaction expired due to old blockhash. Please try again';
            } else if (error.message.includes('insufficient funds')) {
              errorMessage = 'Insufficient SOL balance for transaction fees';
            } else if (error.message.includes('Simulation failed')) {
              errorMessage =
                'Transaction simulation failed. Please check your inputs';
            } else if (error.message.includes('custom program error')) {
              const errorMatch = error.message.match(
                /custom program error: (0x[0-9a-fA-F]+)/,
              );
              if (errorMatch) {
                const errorCode = errorMatch[1];
                switch (errorCode) {
                  case '0x0':
                    errorMessage = 'Unauthorized access';
                    break;
                  case '0x1':
                    errorMessage = 'User vault not found';
                    break;
                  default:
                    errorMessage = `Program error: ${errorCode}`;
                }
              }
            } else if (error.message.includes('AccountNotFound')) {
              errorMessage =
                'Program account not found. Check program deployment';
            } else {
              errorMessage = error.message;
            }
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

  async function requestSolAirdrop(pubkey: PublicKey, lamports: number) {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'requestAirdrop',
      params: [pubkey.toBase58(), lamports],
    };

    const res = await fetch(SOLANA_VALIDATOR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await res.json();
    if (result.error)
      throw new Error(`Airdrop failed: ${result.error.message}`);
    return result.result;
  }

  const { deauthorizeSession } = useAuthorization();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnectPress = useCallback(async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      await transact(async wallet => {
        await deauthorizeSession(wallet);
      });
    } catch (err: any) {
      toast.show({
        message: err instanceof Error ? err.message : err,
        type: 'error',
      });
    } finally {
      setDisconnecting(false);
    }
  }, [disconnecting, deauthorizeSession]);

  return (
    <LinearGradient
      colors={['#001F3F', '#003366', '#001F3F']}
      style={styles.container}>
      <NavBar />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>

          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {name?.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.cardValue}>{name}</Text>
              <Text style={styles.cardLabel}>
                Age:&nbsp;<Text style={styles.cardValue}>{age}</Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setModalVisible(true)}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wallet</Text>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceText}>
              {(balance / 1_000_000_000.0).toFixed(3)}
              <Text style={styles.tokenLabel}>&nbsp;SOL</Text>
            </Text>
            <TouchableOpacity
              style={styles.airdropButton}
              onPress={handleGetTokens}
              disabled={getSolLoading}>
              <Text style={styles.airdropText} disabled={balance > 0}>
                {getSolLoading ? 'Loading...' : 'Get SOL'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.walletRow}>
            <Icon name="account-balance-wallet" size={24} color="#00c9a7" />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.walletName}>{account?.label || 'User'}</Text>
              <Text style={styles.walletAddress}>
                {pubkey?.toBase58().slice(0, 6)}...
                {pubkey?.toBase58().slice(-6)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                pubkey && toast.show({ message: 'Copied!', type: 'success' })
              }
              style={{ marginLeft: 'auto' }}>
              <Icon name="content-copy" size={20} color="#ccc" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.disconnectButton}>
            <Text
              style={styles.disconnectText}
              onPress={() => handleDisconnectPress()}>
              Disconnect
            </Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={styles.version}>v1.0.0</Text>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#001F3F', '#003366', '#001F3F']}
            style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Update Profile</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter name"
              placeholderTextColor="#ccc"
            />
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="Enter age"
              keyboardType="numeric"
              placeholderTextColor="#ccc"
            />
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSaveProfile}>
              <Text style={styles.modalSaveText}>Update</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { padding: 24, paddingTop: 24, alignItems: 'center' },

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  addressBox: {
    backgroundColor: theme.colors.inputBackground, // translucent white background
    paddingVertical: theme.spacing.small - 2, // 6px -> small (8) - 2
    paddingHorizontal: theme.spacing.medium, // 16px
    borderRadius: theme.radius.large, // 20px
    marginTop: theme.spacing.small + 2, // 10px -> small (8) + 2
  },
  addressText: { color: '#fff', fontSize: 14 },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  infoContainer: {
    justifyContent: 'center',
  },

  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardTitle: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    fontWeight: '700',
  },
  cardLabel: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 10,
  },
  cardValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },

  editButton: {
    marginTop: 16,
    backgroundColor: theme.colors.secondaryAction,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  balanceText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  tokenLabel: {
    color: '#00c9a7',
    fontSize: 16,
  },
  airdropButton: {
    backgroundColor: theme.colors.primaryAction,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  airdropText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },

  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  walletName: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  walletAddress: {
    color: '#bbb',
    fontSize: 12,
  },

  disconnectButton: {
    backgroundColor: '#ff4d4d',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  disconnectText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  version: {
    fontSize: 12,
    color: '#aaa',
    opacity: 0.6,
    marginTop: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  modalContainer: {
    padding: theme.spacing.large,
    borderTopLeftRadius: theme.radius.large,
    borderTopRightRadius: theme.radius.large,
    overflow: 'hidden',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.medium,
  },

  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    padding: theme.spacing.medium,
    fontSize: 16,
    marginBottom: theme.spacing.medium,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.inputBackground,
  },

  modalSaveButton: {
    backgroundColor: theme.colors.buttonBackground,
    paddingVertical: theme.spacing.medium,
    borderRadius: theme.radius.medium,
    alignItems: 'center',
    marginBottom: theme.spacing.small,
  },

  modalSaveText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: theme.fontWeights.medium,
  },

  modalCancelText: {
    textAlign: 'center',
    color: theme.colors.secondaryAction,
    fontSize: 14,
  },
});

export default ProfileScreen;
