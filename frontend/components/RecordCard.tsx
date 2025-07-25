import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import { Alert } from 'react-native';
import bs58 from 'bs58';
import { useAuthorization } from './providers/AuthorizationProvider';
import { useSolanaMessageSigner } from '../hooks/useSignMessage';
import { REST_ENDPOINT } from '../util/constants';

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

  console.log(record);

  const onViewRecord = async (record: RecordType) => {
    try {
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

      // Get server-detected file type if available
      const serverDetectedType = response.headers.get('X-Detected-File-Type');

      // Enhanced file type detection function
      const detectFileTypeAndExtension = (
        base64Data: string,
        fileName: string = '',
        serverType: string = '',
      ) => {
        // Use server detection first if available
        if (serverType && serverType !== 'unknown') {
          const typeMap: { [key: string]: { type: string; mimeType: string } } = {
            pdf: { type: 'pdf', mimeType: 'application/pdf' },
            jpeg: { type: 'jpg', mimeType: 'image/jpeg' },
            png: { type: 'png', mimeType: 'image/png' },
            gif: { type: 'gif', mimeType: 'image/gif' },
          };

          if (typeMap[serverType]) {
            return typeMap[serverType];
          }
        }

        // Check magic bytes from base64 data to detect actual file type
        const detectFromMagicBytes = (data: string) => {
          try {
            const firstBytes = atob(data.substring(0, 40)); // Decode first ~30 bytes
            const bytes = Array.from(firstBytes).map(char =>
              char.charCodeAt(0),
            );

            // PDF signature: %PDF
            if (
              bytes[0] === 0x25 &&
              bytes[1] === 0x50 &&
              bytes[2] === 0x44 &&
              bytes[3] === 0x46
            ) {
              return { type: 'pdf', mimeType: 'application/pdf' };
            }

            // JPEG signatures: FF D8 FF
            if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
              return { type: 'jpg', mimeType: 'image/jpeg' };
            }

            // PNG signature: 89 50 4E 47 0D 0A 1A 0A
            if (
              bytes[0] === 0x89 &&
              bytes[1] === 0x50 &&
              bytes[2] === 0x4e &&
              bytes[3] === 0x47
            ) {
              return { type: 'png', mimeType: 'image/png' };
            }

            // GIF signatures: GIF87a or GIF89a
            if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
              return { type: 'gif', mimeType: 'image/gif' };
            }
          } catch (e) {
            console.log('Could not detect file type from magic bytes');
          }
          return null;
        };

        // Try to detect from magic bytes
        const magicDetection = detectFromMagicBytes(base64Data);
        if (magicDetection) {
          return magicDetection;
        }

        // Fallback to filename extension
        if (fileName) {
          const ext = fileName.toLowerCase().split('.').pop();
          switch (ext) {
            case 'pdf':
              return { type: 'pdf', mimeType: 'application/pdf' };
            case 'jpg':
            case 'jpeg':
              return { type: 'jpg', mimeType: 'image/jpeg' };
            case 'png':
              return { type: 'png', mimeType: 'image/png' };
            case 'gif':
              return { type: 'gif', mimeType: 'image/gif' };
            case 'txt':
              return { type: 'txt', mimeType: 'text/plain' };
            case 'doc':
              return { type: 'doc', mimeType: 'application/msword' };
            case 'docx':
              return {
                type: 'docx',
                mimeType:
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              };
            default:
              break;
          }
        }

        // Default to PDF for medical records
        return { type: 'pdf', mimeType: 'application/pdf' };
      };

      let fileInfo = detectFileTypeAndExtension(
        base64Data,
        record.title,
        serverDetectedType || '',
      );
      const extension = fileInfo.type;
      const detectedMimeType = fileInfo.mimeType;

      console.log(
        '📄 Server detected type:',
        serverDetectedType,
        'Final type:',
        extension,
        'MIME type:',
        detectedMimeType,
      );

      // Create a unique filename
      const timestamp = Date.now();
      const sanitizedTitle = record.title.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedTitle}_${recordID}_${timestamp}.${extension}`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      console.log('💾 Saving file to:', filePath);

      // Write file to device storage using base64 data directly
      await RNFS.writeFile(filePath, base64Data, 'base64');

      console.log('✅ File saved successfully');

      // Verify file was written
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error('Failed to save file to device');
      }

      // fileInfo = await RNFS.stat(filePath);
      // console.log('📊 File info:', {
      //   size: fileInfo.size,
      //   path: fileInfo.path,
      // });

      // Open the file
      await FileViewer.open(filePath, {
        showOpenWithDialog: true,
        showAppsSuggestions: true,
      });
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
          onPress: () => onViewRecord(record),
        },
      ]);
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
          onPress={() => onViewRecord(record)}>
          <Icon name="visibility" size={16} color="#fff" />
          <Text style={styles.buttonText}>View</Text>
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
