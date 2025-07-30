import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
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
import {PROGRAM_ID} from '../util/constants';
import {useConnection} from '../components/providers/ConnectionProvider';
import {useToast} from '../components/providers/ToastContext';
import {useAuthorization} from '../components/providers/AuthorizationProvider';
import {sha256} from '@noble/hashes/sha256';
import {uploadJsonToPinata} from '../util/ipfs';
import {Buffer} from 'buffer';
import theme from '../util/theme';

function extractBase64FromPemWrappedKey(base64Pem: string): string {
  const pemString = Buffer.from(base64Pem, 'base64').toString('utf-8');
  return pemString
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');
}

interface RecordCounterData {
  recordId: number;
}

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
      const cid = await uploadJsonToPinata(enc);
      await uploadHealthRecordTransaction(
        cid,
        selectedFile?.type,
        JSON.stringify(enc).length,
      );
    } catch (e: any) {
      console.error('=========================', e);
    } finally {
      setUploadHealthRecordLoading(false);
    }
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

    throw new Error('Transaction confirmation timeout');
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
            const id = Number(currentRecordId);
            recordIdBuffer.writeUInt32LE(id & 0xffffffff, 0);
            recordIdBuffer.writeUInt32LE((id >>> 32) & 0xffffffff, 4);
          }

          const [healthRecordPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('health_record'),
              userPubkey.toBuffer(),
              recordIdBuffer,
            ],
            PROGRAM_ID,
          );

          const testEncryptedData = enc;
          const testMimeType = mimeType;
          const testFileSize = fileSize;
          const testDescription = description;
          const testTitle = title;

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

          // await confirmTransactionWithPolling(txid, 'confirmed');
          await connection.confirmTransaction(txid, 'confirmed');

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
        } finally {
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
              <Text style={styles.headerTitle}>Upload Health Record</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Title Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Record Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Blood Test Results - July 2025"
                  placeholderTextColor="#aaa"
                  value={title}
                  onChangeText={text => {
                    console.log('📥 Title input:', text);
                    setTitle(text);
                  }}
                  maxLength={50}
                />
              </View>

              {/* Description Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  placeholder="e.g., Complete blood count and lipid panel from City Hospital. Shows improved cholesterol levels."
                  placeholderTextColor="#aaa"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={100}
                />
              </View>

              {/* File Upload */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Health Record File *</Text>
                <TouchableOpacity
                  style={styles.uploadBox}
                  onPress={handleFileSelect}
                  activeOpacity={0.9}>
                  <View style={styles.uploadBoxContent}>
                    <Icon name="folder" size={48} color="white"></Icon>
                    <Text style={styles.uploadText}>
                      {selectedFile
                        ? selectedFile.name
                        : 'Tap to select your health record'}
                    </Text>
                    {!selectedFile ? (
                      <Text style={styles.uploadSubText}>
                        Supported formats: PDF, JPG, PNG
                      </Text>
                    ) : (
                      <View style={styles.fileInfo}>
                        <Text style={styles.fileSize}>
                          Size: {(selectedFile.size / 1024).toFixed(1)} KB
                        </Text>
                        <Text style={styles.fileType}>
                          Type: {selectedFile.type}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Security Notice */}
              <View style={styles.securityNotice}>
                <Icon name="verified-user" size={20} color="#4CAF50" />
                <Text style={styles.securityText}>
                  Your data is encrypted end-to-end and stored securely. You can
                  maintain full control over who can access your records.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  uploadHealthRecordLoading && styles.disabledButton,
                ]}
                onPress={handleUpload}
                disabled={
                  uploadHealthRecordLoading ||
                  !title ||
                  !description ||
                  !selectedFile
                }>
                <Icon name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>
                  {uploadHealthRecordLoading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default UploadRecordScreen;

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
  howItWorksContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A9EFF',
    marginLeft: 8,
  },
  infoDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 16,
    marginLeft: 28,
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 14,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inputHelper: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    lineHeight: 16,
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  uploadBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  uploadBoxContent: {
    alignItems: 'center',
    padding: 20,
  },
  uploadText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadSubText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  fileInfo: {
    alignItems: 'center',
    marginTop: 8,
  },
  fileSize: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  fileType: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
    lineHeight: 16,
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#004080',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  uploadButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});
