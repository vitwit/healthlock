import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import ConnectButton from '../components/ConnectButton';
import {useAuthorization} from '../components/providers/AuthorizationProvider';

import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '../components/providers/NavigationProvider';
import SelectRoleCard from '../components/SelectRoleCard';
import {useToast} from '../components/providers/ToastContext';

const ConnectWalletScreen: React.FC = () => {
  const {navigate, setSelectedRole, selectedRole} = useNavigation();

  const {selectedAccount} = useAuthorization();
  const toast = useToast();

  useEffect(() => {
    if (selectedAccount) {
      navigate('Dashboard');
    }
  }, [selectedAccount]);

  return (
    <LinearGradient
      colors={['#001F3F', '#003366', '#001F3F']}
      style={styles.container}>
      <View style={styles.wrapper}>
        <Text style={styles.heading}>Welcome to HealthLock</Text>
        <Text style={styles.subheading}>Choose your role to get started</Text>

        <View style={styles.cardContainer}>
          <>
            <SelectRoleCard
              description="Manage your personal health records"
              title="User"
              icon="person-pin"
              selected={selectedRole === 'user'}
              onPress={() => {
                setSelectedRole('user');
              }}
            />

            <SelectRoleCard
              description="Access and manage records"
              title="Organization"
              icon="domain"
              selected={selectedRole === 'organization'}
              onPress={() => {
                setSelectedRole('organization');
              }}
            />
          </>
        </View>

        <View style={styles.connectButtonWrapper}>
          <ConnectButton
            onError={(message: string) => {
              toast.show({
                message: message,
                type: 'error',
              });
            }}
          />
        </View>
      </View>
    </LinearGradient>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 32,
    textAlign: 'center',
  },
  cardContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  roleCard: {
    flex: 1,
    padding: 24,
    marginHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  selectedCard: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  connectButtonWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  errorBanner: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#ff4d4f',
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
  },
});

export default ConnectWalletScreen;
