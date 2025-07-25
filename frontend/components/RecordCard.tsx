import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import { Alert } from 'react-native';
import bs58 from 'bs58';
import { useAuthorization } from './providers/AuthorizationProvider';
import { useSolanaMessageSigner } from '../hooks/useSignMessage';
import { ERR_UNKNOWN, REST_ENDPOINT } from '../util/constants';
import { Buffer } from 'buffer';
import { saveFileToDownloads } from './OrganiaztionRecordCard';
import { useToast } from './providers/ToastContext';
import { useState } from 'react';

export type RecordType = {
  id: number;
  title: string;
  description: string;
  createdAt: number;
  accessGrantedTo: number;
  encryptedData: string;
  owner: string;
  mimeType: string;
};

const RecordCard = ({
  record,
  navigate,
  onDelete,
}: {
  record: RecordType;
  navigate: any;
  onDelete: (recordId: number, title: string) => void;
}) => {
  const formattedDate = new Date(record.createdAt * 1000).toLocaleDateString();
  const { signMessage } = useSolanaMessageSigner();
  const { selectedAccount } = useAuthorization();

  const toast = useToast();

  const [viewLoading, setViewLoading] = useState<boolean>(false);
  const onViewRecord = async () => {
    try {
      setViewLoading(true);
      console.log('🚀 Starting record download process...');

      const signer = selectedAccount?.publicKey?.toBase58();
      const recordID = record.id;

      if (!signer) {
        throw new Error('Missing signer public key');
      }

      // Create signature message
      const message = `record-access:${selectedAccount?.publicKey?.toBase58()}:${record.owner}:${recordID}`;
      console.log('📝 Signing message:', message);

      const signatureBytes = await signMessage(message);
      const signature = bs58.encode(signatureBytes);

      console.log('📤 Sending download request...');

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
          recordOwner: record.owner
        }),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      // Read the binary data as base64 directly from React Native fetch
      const base64Data = await response.text();
      console.log('📦 Downloaded base64 data length:', base64Data.length);

      if (!base64Data || base64Data.length === 0) {
        throw new Error('Downloaded file is empty');
      }

      const decodedBytes = Buffer.from(base64Data, 'base64');

      // Preview first few bytes for file type detection
      console.log('🔍 First bytes:', decodedBytes.slice(0, 4));

      const mimeTypeToExtension: { [mimeType: string]: string } = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg', // Not standard, but included for completeness
      };


      const extension = mimeTypeToExtension[record.mimeType] || "png";
      // Create a unique filename
      const sanitizedTitle = record.title.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedTitle}_${recordID}.${extension}`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      console.log('💾 Saving file to:', filePath);

      try {

        const savedPath = await saveFileToDownloads(base64Data, fileName);

        // await Share.open({
        //   url: savedPath,
        //   type: record.mimeType,
        //   showAppsToView: true,

        // });
        toast.show({
          message: `File saved to ${savedPath}`,
          type: "success"
        })

      } catch (err: any) {
        toast.show({
          message: `Failed to save: ${err?.message || ERR_UNKNOWN}`,
          type: "error"
        })
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
        { text: 'OK' },
        {
          text: 'Retry',
          onPress: () => onViewRecord(),
        },
      ]);
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{record.title}</Text>

      <Text style={styles.cardDesc}>📝 {record.description}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>🕒</Text>
          <Text style={styles.metaValue}>&nbsp;{formattedDate}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>🔐</Text>
          <Text style={styles.metaValue}>&nbsp;{record.accessGrantedTo}</Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => !viewLoading && onViewRecord()}
          disabled={viewLoading}
        >
          {viewLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="visibility" size={16} color="#fff" />
              <Text style={styles.buttonText}>View</Text>
            </>
          )}
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.button}
          onPress={() => navigate('ShareRecord', { record })}>
          <Icon name="share" size={16} color="#fff" />
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => {
            onDelete(record.id, record.title);
          }}>
          <Icon name="delete" size={16} color="red" />
          <Text style={[styles.buttonText, { color: 'red' }]}>Delete</Text>
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginLeft: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
  deleteButton: {
    borderWidth: 1,
    borderColor: 'red',
    backgroundColor: 'rgba(255,0,0,0.08)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default RecordCard;
