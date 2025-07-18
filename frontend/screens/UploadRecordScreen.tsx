import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation} from '../components/providers/NavigationProvider';

const {width} = Dimensions.get('window');

const UploadRecordScreen = () => {
  const {navigate, goBack} = useNavigation();

  const handleBackPress = () => {
    goBack();
  };

  const handleUpload = () => {
    console.log('Upload & Encrypt pressed');
  };

  const handleFileSelect = () => {
    console.log('File selection pressed');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.gradient}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Upload Records</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.spacer20} />
          <Text style={styles.title}>📤 Upload Health Records</Text>
          <View style={styles.spacer20} />

          {/* File Upload Box */}
          <TouchableOpacity
            style={styles.uploadBox}
            onPress={handleFileSelect}
            activeOpacity={0.8}>
            <View style={styles.uploadBoxContent}>
              <Text style={styles.fileIcon}>📁</Text>
              <Text style={styles.uploadText}>
                Drag & drop your health records here
              </Text>
              <Text style={styles.uploadSubText}>or click to browse files</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.spacer24} />

          {/* TEE Security Info */}
          <View style={styles.securityBox}>
            <Text style={styles.securityTitle}>🔒 TEE Security</Text>
            <Text style={styles.securityDescription}>
              Your files are encrypted using Trusted Execution Environment (TEE)
              technology.
            </Text>
          </View>

          <View style={styles.spacer24} />

          {/* Upload Button */}
          <LinearGradient
            colors={['#4FACFE', '#00F2FE']}
            style={styles.uploadButtonWrapper}>
            <TouchableOpacity
              onPress={handleUpload}
              activeOpacity={0.9}
              style={styles.uploadButtonInner}>
              <Text style={styles.uploadButtonText}>Upload & Encrypt</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#667EEA',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  spacer20: {
    height: 20,
  },
  spacer24: {
    height: 24,
  },
  title: {
    fontSize: 24,
    color: 'white',
    fontWeight: '500',
    textAlign: 'center',
  },
  uploadBox: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBoxContent: {
    alignItems: 'center',
  },
  fileIcon: {
    fontSize: 40,
    marginBottom: 8,
    color: 'white',
  },
  uploadText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  uploadSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  securityBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 15,
    padding: 16,
  },
  securityTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  securityDescription: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  uploadButtonWrapper: {
    width: '100%',
    borderRadius: 26,
    overflow: 'hidden',
    marginTop: 8,
  },
  uploadButtonInner: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
});

export default UploadRecordScreen;
