import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ConnectionProvider } from './components/providers/ConnectionProvider';
import { AuthorizationProvider } from './components/providers/AuthorizationProvider';
import {
  NavigationProvider,
  useNavigation,
} from './components/providers/NavigationProvider';
import { TextEncoder, TextDecoder } from 'text-encoding';

import ConnectWalletScreen from './screens/ConnectWalletScreen';
import DashboardScreen from './screens/DashboardScreen';
import UploadRecordScreen from './screens/UploadRecordScreen';
import ViewRecordsScreen from './screens/ViewRecordsScreen';
import OrganizationsScreen from './screens/OrganizationsScreen';
import RegisterOrganizationScreen from './screens/RegisterOrganizationScreen';
import ShareRecordDialogScreen from './screens/ShareRecordDialogScreen';
import { ToastProvider } from './components/providers/ToastContext';
import { TEEStateProvider } from './components/providers/TEEStateProvider';
import { SOLANA_VALIDATOR } from './util/constants';
import MainScreen from './screens/MainScreen';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any;
}

function AppNavigator() {
  const { currentScreen } = useNavigation();

  switch (currentScreen) {
    case 'ConnectWallet':
      return <ConnectWalletScreen />;
    case 'Dashboard':
      return <MainScreen />;
    case 'Upload':
      return <UploadRecordScreen />;

    case 'Organizations':
      return <OrganizationsScreen />;

    case 'ShareRecord':
      return <ShareRecordDialogScreen />;

    default:
      return <ConnectWalletScreen />;
  }
}

export default function App() {
  return (
    <ConnectionProvider
      config={{ commitment: 'processed' }}
      endpoint={SOLANA_VALIDATOR}>
      <AuthorizationProvider>
        <TEEStateProvider>
          <NavigationProvider>
            <ToastProvider>
              <SafeAreaView style={styles.shell}>
                <AppNavigator />
              </SafeAreaView>
            </ToastProvider>
          </NavigationProvider>
        </TEEStateProvider>
      </AuthorizationProvider>
    </ConnectionProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: '100%',
  },
});
