import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import {Alert} from 'react-native';
import bs58 from 'bs58';
import {useAuthorization} from './providers/AuthorizationProvider';
import {useSolanaMessageSigner} from '../hooks/useSignMessage';
import {ERR_UNKNOWN, REST_ENDPOINT} from '../util/constants';
import {shortenAddress} from '../util/address';
import {PublicKey} from '@solana/web3.js';

import {PermissionsAndroid, Platform} from 'react-native';
import {Buffer} from 'buffer';
import {useToast} from './providers/ToastContext';

/**
 * Saves a base64-encoded file to the Android public Downloads directory.
 * @param base64Data - The base64 string of the file.
 * @param fileName - The name of the file, including its extension (e.g., `myfile.jpg`).
 * @returns The full path of the saved file.
 */
export const saveFileToDownloads = async (
  base64Data: string,
  fileName: string,
): Promise<string> => {
  try {
    // Request permission on Android 13 (API 33) and below
    if (Platform.OS === 'android' && Platform.Version <= 32) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Storage permission denied');
      }
    }

    // Full path to the Downloads directory
    const downloadsPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;

    // Write the file using base64 encoding
    await RNFS.writeFile(downloadsPath, base64Data, 'base64');
    console.log('✅ File saved to:', downloadsPath);

    return downloadsPath;
  } catch (error: unknown) {
    console.error('❌ Failed to save file:', error);
    throw error instanceof Error ? error : new Error('Unknown error');
  }
};

export type OrganizationRecordType = {
  id: number;
  title: string;
  description: string;
  createdAt: number;
  accessGrantedTo: number;
  encryptedData: string;
  owner: string;
  mimeType: string;
};

const OrganizationRecordCard = ({
  record,
  navigate,
  onDelete,
}: {
  record: OrganizationRecordType;
  navigate: any;
  onDelete: (recordId: number, title: string) => void;
}) => {
  console.log(record);
  const formattedDate = new Date(record.createdAt * 1000).toLocaleDateString();
  const {signMessage} = useSolanaMessageSigner();
  const {selectedAccount} = useAuthorization();

  const onViewRecord = async () => {
    try {
      const signer = selectedAccount?.publicKey?.toBase58();
      const recordID = record.id;
      const toast = useToast();

      if (!signer) {
        throw new Error('Missing signer public key');
      }

      // Create signature message
      const message = `record-access:${selectedAccount?.publicKey?.toBase58()}:${
        record.owner
      }:${recordID}`;

      const signatureBytes = await signMessage(message);
      const signature = bs58.encode(signatureBytes);

      // Send request to backend with specific options for React Native
      const response = await fetch(REST_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cid: record.encryptedData,
          signer: signer,
          signature: signature,
          recordId: recordID,
          recordOwner: record.owner,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      // Read the binary data as base64 directly from React Native fetch
      const base64Data = await response.text();

      if (!base64Data || base64Data.length === 0) {
        throw new Error('Downloaded file is empty');
      }

      const decodedBytes = Buffer.from(base64Data, 'base64');

      // Preview first few bytes for file type detection
      console.log('🔍 First bytes:', decodedBytes.slice(0, 4));

      const mimeTypeToExtension: {[mimeType: string]: string} = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg', // Not standard, but included for completeness
      };

      const extension = mimeTypeToExtension[record.mimeType] || 'png';
      // Create a unique filename
      const sanitizedTitle = record.title.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedTitle}_${recordID}.${extension}`;

      try {
        const savedPath = await saveFileToDownloads(base64Data, fileName);

        // await Share.open({
        //   url: savedPath,
        //   type: record.mimeType,
        //   showAppsToView: true,

        // });

        toast.show({
          message: `File saved to ${savedPath}`,
          type: 'success',
        });
      } catch (err: any) {
        toast.show({
          message: `Failed to save: ${err?.message || ERR_UNKNOWN}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      console.error('❌ Error in onViewRecord:', err);

      let errorMessage = 'Failed to open document';

      if (err.message) {
        if (err.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (err.message.includes('decrypt')) {
          errorMessage = 'Failed to decrypt file. Please try again.';
        } else if (err.message.includes('404')) {
          errorMessage = 'File not found on server.';
        } else if (err.message.includes('401') || err.message.includes('403')) {
          errorMessage =
            'Access denied. You may not have permission to view this file.';
        } else if (err.message.includes('FileReader.readAsArrayBuffer')) {
          errorMessage = 'File processing error. Please try again.';
        } else {
          errorMessage = err.message;
        }
      }

      Alert.alert('Error viewing record', errorMessage, [
        {text: 'OK'},
        {
          text: 'Retry',
          onPress: () => onViewRecord(),
        },
      ]);
    }
  };

  return (
    <View style={styles.card}>
      {/* Title */}
      <Text style={styles.cardTitle}>{record.title}</Text>

      {/* Owner */}

      {/* Description */}
      <Text style={styles.cardDesc}>📝 {record.description}</Text>
      <Text style={styles.ownerText}>
        👤 {shortenAddress(new PublicKey(record.owner), 9)}
      </Text>

      {/* Metadata */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>🕒</Text>
          <Text style={styles.metaValue}> {formattedDate}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={onViewRecord}>
          <Icon name="visibility" size={16} color="#fff" />
          <Text style={styles.buttonText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  ownerText: {
    fontSize: 13,
    color: '#A0AEC0',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 32,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaValue: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default OrganizationRecordCard;
