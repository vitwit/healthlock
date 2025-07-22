import React, { useEffect, useState } from 'react';
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
import { useNavigation } from '../components/providers/NavigationProvider';
import { useTEEContext } from '../components/providers/TEEStateProvider';

function extractBase64FromPemWrappedKey(base64Pem: string): string {
  // Decode the PEM wrapper
  const pemString = Buffer.from(base64Pem, 'base64').toString('utf-8');
  // Extract only the Base64 part from the PEM
  return pemString
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');
}


type EncryptResult = {
  encrypted_aes_key: string;
  ciphertext: string;
  nonce: string;
};

const { Encryptor } = NativeModules;

const UploadRecordScreen = () => {
  const { navigate, goBack } = useNavigation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const { teeState } = useTEEContext();

  const handleBackPress = () => {
    goBack();
  };

  useEffect(() => {
    if (!teeState?.pubkey) {

    }
  }, [teeState]);

  const handleUpload = async () => {
    try {
      const base64DerKey = extractBase64FromPemWrappedKey(teeState?.pubkey);
      const enc: EncryptResult = await Encryptor.encryptFromUri(selectedFile.uri, base64DerKey);
      console.log("======================", enc);
    } catch (e:any) {
      console.error("=========================", e);
    }
  };

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
          style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
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

              <TouchableOpacity style={styles.uploadBox} onPress={handleFileSelect} activeOpacity={0.9}>
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

              <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
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
