import React from 'react';
import {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation} from '../components/providers/NavigationProvider';
import {PublicKey} from '@solana/web3.js';
import {PROGRAM_ID, TEE_STATE} from '../util/constants';
import {useConnection} from './../components/providers/ConnectionProvider';
import {parseTEEState} from '../api/state';

export default function HomeScreen() {
  const {navigate, selectedRole} = useNavigation();

  useEffect(() => {
    console.log(selectedRole);
  }, [selectedRole]);

  const getTEEStatePDA = (): PublicKey => {
    const [teeStatePDA] = PublicKey.findProgramAddressSync(
      [TEE_STATE],
      PROGRAM_ID,
    );
    return teeStatePDA;
  };

  const {connection} = useConnection();

  useEffect(() => {
    const x = async () => {
      try {
        const globalStatePDA = getTEEStatePDA();
        const accountInfo = await connection.getAccountInfo(globalStatePDA);
        console.log(accountInfo);

        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [{dataSize: 1073}],
        });

        for (const account of accounts) {
          const parsed = parseTEEState(account.account.data);
          console.log('Parsed TEE Node:', parsed);
        }
      } catch (err) {
        console.log('err = ', err);
      }
    };
    x()
      .then(res => console.log('res =========>', res))
      .catch(err => console.log('errr =======> ', err));
  }, []);

  return (
    <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.title}>HealthLock</Text>
        <TouchableOpacity
          onPress={() => {
            /* navigate('Settings') */
          }}>
          <Icon name="settings" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* Stat Row */}
        <View style={styles.statRow}>
          <StatCard value="12" label="Total Records" />
          <StatCard value="8" label="Shared Records" />
        </View>

        {/* Action Cards */}
        <ActionCard
          icon="📤"
          title="Upload Records"
          desc="Add new health records securely"
          onPress={() => navigate('Upload')}
        />
        <ActionCard
          icon="📋"
          title="View Records"
          desc="Browse all your records"
          onPress={() => navigate('Records')}
        />
        <ActionCard
          icon="🏥"
          title="Organizations"
          desc="Manage healthcare providers"
          onPress={() => navigate('Organizations')}
        />
      </ScrollView>
    </LinearGradient>
  );
}

function StatCard({value, label}: {value: string; label: string}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  onPress,
}: {
  icon: string;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
      <View>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDesc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: '#667EEA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    borderRadius: 20,
    marginVertical: 8,
  },
  icon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  actionDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
});
