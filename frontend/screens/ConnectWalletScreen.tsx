import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';

import ConnectButton from '../components/ConnectButton';
import {
  useAuthorization,
} from '../components/providers/AuthorizationProvider';
import AlertBanner from '../components/AlertBanner';

import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '../components/providers/NavigationProvider';

const { width } = Dimensions.get('window');

const ConnectWalletScreen: React.FC = () => {

  const { navigate } = useNavigation();

  const { selectedAccount } = useAuthorization();
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    console.log(selectedAccount)
    if (selectedAccount) {
      navigate('Dashboard')
    }
  }, [selectedAccount]);

  return (
    <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.container}>
      <View style={styles.innerContainer}>
        {(showError && errorMessage) && (
          <AlertBanner message={errorMessage} type="error" />
        )}
        <Text style={styles.emoji}>💳</Text>
        <Text style={styles.title}>Connect Your Solana Wallet</Text>
        <Text style={styles.subtitle}>
          Connect your wallet to securely manage your health records on the Solana blockchain
        </Text>
        <ConnectButton

          onError={(message: string) => {

            setShowError(true);

            setErrorMessage(message);

            setTimeout(() => {
              setShowError(false);
              setErrorMessage('');
            }, 3000);
          }} />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%'
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 8,
    width: '100%'
  },
  buttonWrapper: {
    width: width * 0.85,
    height: 52,
    borderRadius: 50,
    overflow: 'hidden'
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default ConnectWalletScreen;
