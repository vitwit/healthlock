import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  NativeModules,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DocumentPicker from 'react-native-document-picker';
import {useNavigation} from '../components/providers/NavigationProvider';
import {useTEEContext} from '../components/providers/TEEStateProvider';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {ERR_UNKNOWN, PROGRAM_ID} from '../util/constants';
import {useConnection} from '../components/providers/ConnectionProvider';
import {encodeAnchorString} from './DashboardScreen';
import {useToast} from '../components/providers/ToastContext';
import {useAuthorization} from '../components/providers/AuthorizationProvider';
import {sha256} from '@noble/hashes/sha256';

function extractBase64FromPemWrappedKey(base64Pem: string): string {
  // Decode the PEM wrapper
  const pemString = Buffer.from(base64Pem, 'base64').toString('utf-8');
  // Extract only the Base64 part from the PEM
  return pemString
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');
}

interface RecordCounterData {
  recordId: number;
}

type EncryptResult = {
  encrypted_aes_key: string;
  ciphertext: string;
  nonce: string;
};

const {Encryptor} = NativeModules;

const UploadRecordScreen = () => {
  const {connection} = useConnection();
  const {navigate, goBack} = useNavigation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const {teeState} = useTEEContext();

  const handleBackPress = () => {
    goBack();
  };

  useEffect(() => {
    if (!teeState?.pubkey) {
    }
  }, [teeState]);

  const [uploadHealthRecordLoading, setUploadHealthRecordLoading] =
    useState<boolean>(false);
  const handleUpload = async () => {
    try {
      setUploadHealthRecordLoading(true);
      const base64DerKey = extractBase64FromPemWrappedKey(teeState?.pubkey);
      const enc: EncryptResult = await Encryptor.encryptFromUri(
        selectedFile.uri,
        base64DerKey,
      );
      await uploadHealthRecordTransaction(enc, 'pdf', 5);
    } catch (e: any) {
      console.error('=========================', e);
    }
  };

  const RECORD_COUNTER_SEED = Buffer.from('record_counter');
  const getRecordCounterPDA = (): PublicKey => {
    const [recordCounterPDA] = PublicKey.findProgramAddressSync(
      [RECORD_COUNTER_SEED],
      PROGRAM_ID,
    );
    return recordCounterPDA;
  };

  const parseRecordCounter = (data: Buffer): RecordCounterData | null => {
    try {
      const view = new DataView(data.buffer);
      let offset = 8;

      const recordId = Number(view.getBigUint64(offset, true));

      return {recordId};
    } catch (error) {
      console.error('Error parsing record counter data:', error);
      return null;
    }
  };

  const toast = useToast();
  const {authorizeSession} = useAuthorization();
  const uploadHealthRecordTransaction = useCallback(
    async (enc: EncryptResult, mimeType: string, size: number) => {
      return await transact(async (wallet: Web3MobileWallet) => {
        try {
          console.log('11111111111111111111111111111');
          const [authorizationResult, latestBlockhash] = await Promise.all([
            authorizeSession(wallet),
            connection.getLatestBlockhash(),
          ]);
          console.log('2222222222222222222222');

          const userPubkey = authorizationResult.publicKey;

          const recordCounterPDA = getRecordCounterPDA();
          const recordCounterAccount = await connection.getAccountInfo(
            recordCounterPDA,
          );
          if (!recordCounterAccount || !recordCounterAccount.data) {
            throw new Error(
              'Record counter account not found or not initialized',
            );
          }
          console.log('3333333333333333333333');

          const recordCounter = parseRecordCounter(recordCounterAccount.data);

          const recordIDBuffer = Buffer.from(
            new BigUint64Array([BigInt(recordCounter.recordId)]).buffer,
          );

          console.log('44444444444444444');

          const [healthRecordPda] = await PublicKey.findProgramAddressSync(
            [
              Buffer.from('health_record'),
              userPubkey.toBuffer(),
              recordIDBuffer,
            ],
            PROGRAM_ID,
          );
          console.log('555555555555555555555555');

          const discriminator = Buffer.from(
            sha256('global:upload_health_record').slice(0, 8),
          );

          const v1 = Buffer.from('fedgfhggfhg', 'utf-8');
          const v2 = Buffer.from(mimeType, 'utf-8');
          const v3 = Buffer.from(new BigUint64Array([BigInt(1)]).buffer);
          const v4 = Buffer.from(description, 'utf-8');
          const v5 = Buffer.from(title, 'utf-8');

          const data = Buffer.concat([discriminator, v1, v2, v3, v4, v5]);

          console.log('6666666666666666666666666666');

          const keys = [
            {pubkey: healthRecordPda, isSigner: false, isWritable: true},
            {pubkey: userPubkey, isSigner: true, isWritable: true},
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ];
          console.log('777777777777777777777777');

          const ix = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys,
            data,
          });
          console.log('88888888888888888888888888888');

          const tx = new Transaction({
            ...latestBlockhash,
            feePayer: userPubkey,
          });

          tx.add(ix);
          console.log('999999999999999999999');

          const signedTxs = await wallet.signTransactions({transactions: [tx]});
          const txid = await connection.sendRawTransaction(
            signedTxs[0].serialize(),
          );
          console.log('99999999999999999999999');

          await connection.confirmTransaction(txid, 'confirmed');
          console.log('11010100111000000000000000');

          toast.show({
            type: 'success',
            message: `Successfully registered`,
          });

          return signedTxs[0];
        } catch (error: any) {
          console.log('error>>>>>>>>', error);
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

  const handleFileSelect = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
        allowMultiSelection: false,
      });

      if (res && res.length > 0) {
        setSelectedFile(res[0]);
        console.log('Selected file:', res[0]);
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User cancelled file picker');
      } else {
        console.error('Unknown error: ', err);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#001F3F', '#003366']} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{flex: 1}}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handleBackPress}
                style={styles.backButton}>
                <Icon name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Upload Record</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <TextInput
                style={styles.input}
                placeholder="Record Title"
                placeholderTextColor="#aaa"
                value={title}
                onChangeText={setTitle}
              />

              <TextInput
                style={[styles.input, styles.descriptionInput]}
                placeholder="Description"
                placeholderTextColor="#aaa"
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <TouchableOpacity
                style={styles.uploadBox}
                onPress={handleFileSelect}
                activeOpacity={0.9}>
                <View style={styles.uploadBoxContent}>
                  <Icon name="folder" size={48} color="white"></Icon>
                  <Text style={styles.uploadText}>
                    {selectedFile ? selectedFile.name : 'Tap to select a file'}
                  </Text>
                  {!selectedFile && (
                    <Text style={styles.uploadSubText}>PDF or Image</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleUpload}>
                <Icon name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>Upload & Encrypt</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    color: 'white',
    fontSize: 16,
    marginBottom: 16,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  uploadBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadBoxContent: {
    alignItems: 'center',
  },
  fileIcon: {
    fontSize: 42,
    color: 'white',
    marginBottom: 10,
  },
  uploadText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: 500,
  },
  uploadSubText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
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
});

export default UploadRecordScreen;
