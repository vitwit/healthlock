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
  Alert,
  Keyboard,
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
import RNFS from 'react-native-fs';

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

interface IPFSUploadResponse {
  cid: string;
  size: number;
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
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const {teeState} = useTEEContext();

  const handleBackPress = () => {
    goBack();
  };

  useEffect(() => {
    if (!teeState?.pubkey) {
    }
  }, [teeState]);

  interface EncryptResult {
    [key: string]: any;
  }

  const uploadToIPFS = async (enc: EncryptResult) => {
    const url = 'https://a61574238295.ngrok-free.app/api/v0/add';

    const jsonData = enc;
    const path = `${RNFS.TemporaryDirectoryPath}/data.json`;

    try {
      // Write file to temp storage
      await RNFS.writeFile(path, JSON.stringify(jsonData), 'utf8');

      const formData = new FormData();
      formData.append('file', {
        uri: `file://${path}`,
        name: 'data.json',
        type: 'application/json',
      });

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      console.log('Upload response:', result);
      return result.Hash;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw error;
    }
  };

  const [uploadHealthRecordLoading, setUploadHealthRecordLoading] =
    useState<boolean>(false);
  const handleUpload = async () => {
    Keyboard.dismiss();
    if (!teeState || !selectedFile) {
      Alert.alert('Error', 'File not selected or failed to encrypt');
      return;
    }
    try {
      setUploadHealthRecordLoading(true);
      const base64DerKey = extractBase64FromPemWrappedKey(teeState?.pubkey);
      const enc: EncryptResult = await Encryptor.encryptFromUri(
        selectedFile?.uri,
        base64DerKey,
      );
      const cid = await uploadToIPFS(enc);
      await uploadHealthRecordTransaction(cid, 'pdf', 5);
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
    async (enc: string, mimeType: string, fileSize: number) => {
      return await transact(async (wallet: Web3MobileWallet) => {
        try {
          const [authorizationResult, latestBlockhash] = await Promise.all([
            authorizeSession(wallet),
            connection.getLatestBlockhash(),
          ]);

          const userPubkey = authorizationResult.publicKey;

          const [recordCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('record_counter')],
            PROGRAM_ID,
          );

          const [userVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('user_vault'), userPubkey.toBuffer()],
            PROGRAM_ID,
          );

          // Get current record counter to determine the record ID that will be used
          const recordCounterAccount = await connection.getAccountInfo(
            recordCounterPda,
          );
          if (!recordCounterAccount || !recordCounterAccount.data) {
            throw new Error(
              'Record counter account not found. Please initialize the system first.',
            );
          }

          const recordCounter = parseRecordCounter(recordCounterAccount.data);
          if (!recordCounter) {
            throw new Error('Failed to parse record counter data');
          }

          const currentRecordId = recordCounter.recordId;

          const recordIdBuffer = Buffer.alloc(8);
          try {
            recordIdBuffer.writeBigUInt64LE(BigInt(currentRecordId), 0);
          } catch (error) {
            console.log('writeBigUInt64LE failed, using fallback:', error);
            // Fallback: write as two 32-bit integers (little endian)
            const id = Number(currentRecordId);
            recordIdBuffer.writeUInt32LE(id & 0xffffffff, 0); // Low 32 bits
            recordIdBuffer.writeUInt32LE((id >>> 32) & 0xffffffff, 4); // High 32 bits
          }

          const [healthRecordPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('health_record'),
              userPubkey.toBuffer(),
              recordIdBuffer,
            ],
            PROGRAM_ID,
          );

          const testEncryptedData = enc; // Very short encrypted data
          const testMimeType = mimeType; // Simple MIME type
          const testFileSize = fileSize; // Small file size
          const testDescription = description; // Short description
          const testTitle = title; // Very short title

          // Validate test data lengths (should all pass easily)
          if (testEncryptedData.length > 1048) {
            throw new Error('Encrypted data too large (max 1048 characters)');
          }
          if (testMimeType.length > 100) {
            throw new Error('MIME type too long (max 100 characters)');
          }
          if (testDescription.length > 100) {
            throw new Error('Description too long (max 100 characters)');
          }
          if (testTitle.length > 50) {
            throw new Error('Title too long (max 50 characters)');
          }

          const discriminator = Buffer.from(
            sha256('global:upload_health_record').slice(0, 8),
          );

          const encryptedDataBytes = Buffer.from(testEncryptedData, 'utf-8');
          const encryptedDataLengthBuffer = Buffer.alloc(4);
          encryptedDataLengthBuffer.writeUInt32LE(encryptedDataBytes.length, 0);

          const mimeTypeBytes = Buffer.from(testMimeType, 'utf-8');
          const mimeTypeLengthBuffer = Buffer.alloc(4);
          mimeTypeLengthBuffer.writeUInt32LE(mimeTypeBytes.length, 0);

          const fileSizeBuffer = Buffer.alloc(8);
          fileSizeBuffer.writeBigUInt64LE(BigInt(testFileSize), 0);

          const descriptionBytes = Buffer.from(testDescription, 'utf-8');
          const descriptionLengthBuffer = Buffer.alloc(4);
          descriptionLengthBuffer.writeUInt32LE(descriptionBytes.length, 0);

          const titleBytes = Buffer.from(testTitle, 'utf-8');
          const titleLengthBuffer = Buffer.alloc(4);
          titleLengthBuffer.writeUInt32LE(titleBytes.length, 0);

          // Combine all instruction data
          const instructionData = Buffer.concat([
            discriminator,
            encryptedDataLengthBuffer,
            encryptedDataBytes,
            mimeTypeLengthBuffer,
            mimeTypeBytes,
            fileSizeBuffer,
            descriptionLengthBuffer,
            descriptionBytes,
            titleLengthBuffer,
            titleBytes,
          ]);

          console.log(
            'Instruction data size:',
            instructionData.length,
            'bytes',
          );

          // Create instruction accounts matching your UploadHealthRecord struct order
          const keys = [
            {pubkey: userVaultPda, isSigner: false, isWritable: true},
            {pubkey: recordCounterPda, isSigner: false, isWritable: true},
            {pubkey: healthRecordPda, isSigner: false, isWritable: true},
            {pubkey: userPubkey, isSigner: true, isWritable: true},
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
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

          console.log('Form data....', title, description, {
            recordId: currentRecordId,
            title: testTitle,
            description: testDescription,
            mimeType: testMimeType,
            fileSize: testFileSize,
            healthRecordPda: healthRecordPda.toString(),
          });

          const txid = await connection.sendRawTransaction(
            signedTxs[0].serialize(),
            {
              skipPreflight: false,
              preflightCommitment: 'processed',
            },
          );

          console.log('txn111111');

          const confirmation = await connection.confirmTransaction(
            {
              signature: txid,
              ...latestBlockhash,
            },
            'confirmed',
          );

          if (confirmation.value.err) {
            throw new Error(
              `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
            );
          }

          console.log('Health record uploaded successfully:', {
            txid,
            recordId: currentRecordId,
            title: testTitle,
            description: testDescription,
            mimeType: testMimeType,
            fileSize: testFileSize,
            healthRecordPda: healthRecordPda.toString(),
          });

          toast.show({
            type: 'success',
            message: `Health record "${testTitle}" uploaded successfully!`,
          });

          setTimeout(() => {
            goBack();
          }, 2000);

          return {
            transaction: signedTxs[0],
            txid,
            recordId: currentRecordId,
            healthRecordPda,
          };
        } catch (error: any) {
          console.error('Upload health record transaction error:', error);

          let errorMessage = 'Failed to upload health record';

          if (error.message?.includes('Record counter account not found')) {
            errorMessage = 'System not initialized. Please contact support.';
          } else if (error.message?.includes('insufficient funds')) {
            errorMessage = 'Insufficient SOL balance for transaction fees';
          } else if (error.message?.includes('blockhash not found')) {
            errorMessage = 'Network congestion. Please try again.';
          } else if (
            error.message?.includes('too large') ||
            error.message?.includes('too long')
          ) {
            errorMessage = error.message;
          } else if (error.message?.includes('already in use')) {
            errorMessage = 'Account conflict. Please refresh and try again.';
          } else if (error.logs) {
            const anchorError = error.logs.find(
              (log: string) =>
                log.includes('AnchorError') ||
                log.includes('Program log: Error:'),
            );
            if (anchorError) {
              errorMessage = `Upload failed: ${anchorError}`;
            }
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
    [authorizeSession, connection, toast, title, description],
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
                onChangeText={text => {
                  console.log('📥 Title input:', text);
                  setTitle(text);
                }}
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
    // fontWeight: 500,
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
