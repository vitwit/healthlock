import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import React, { useState, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';

import { useAuthorization } from './providers/AuthorizationProvider';
import { alertAndLog } from '../util/alertAndLog';

type Props = {
  title?: string;
  style?: ViewStyle;
  onError?: (message: string) => void;
};

export default function ConnectButton({
  title = 'Connect Wallet',
  style,
  onError
}: Props) {
  const { authorizeSession } = useAuthorization();
  const [authorizationInProgress, setAuthorizationInProgress] = useState(false);

  const handleConnectPress = useCallback(async () => {
    if (authorizationInProgress) return;
    setAuthorizationInProgress(true);
    try {
      await transact(async (wallet: any) => {
        await authorizeSession(wallet);
      });
    } catch (err: any) {

      const message =
        err instanceof Error ? err.message : String(err);
      if (onError) {
        onError(message);
      }
    } finally {
      setAuthorizationInProgress(false);
    }
  }, [authorizationInProgress, authorizeSession]);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        authorizationInProgress && styles.buttonDisabled,
        style,
      ]}
      onPress={handleConnectPress}
      disabled={authorizationInProgress}>
      {authorizationInProgress ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 180,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
