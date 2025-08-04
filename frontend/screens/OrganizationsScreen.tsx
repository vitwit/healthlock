import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ListRenderItem,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation} from '../components/providers/NavigationProvider';
import {useConnection} from '../components/providers/ConnectionProvider';
import {sha256} from 'js-sha256';
import {PROGRAM_ID} from '../util/constants';
import {PublicKey} from '@solana/web3.js';
import bs58 from 'bs58';
import {ActivityIndicator} from 'react-native';

interface Organization {
  organizationId: number;
  owner: PublicKey;
  name: string;
  contactInfo: string;
  createdAt: number;
}

interface OrganizationCardProps {
  org: Organization;
}

const OrganizationCard: React.FC<OrganizationCardProps> = ({org}) => {
  return (
    <View style={styles.organizationCard}>
      <Text style={styles.organizationName}>🏥 {org.name}</Text>
      <View style={styles.spacer4} />
      <Text style={styles.contactInfo}>📞 {org.contactInfo}</Text>
      <Text style={styles.createdAt}>
        📅 Registered on {new Date(org.createdAt * 1000).toLocaleDateString()}
      </Text>
    </View>
  );
};

const decodeOrganization = (data: Buffer) => {
  let offset = 8;

  const owner = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const organizationId = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const nameLen = data.readUInt32LE(offset);
  offset += 4;
  const name = data.slice(offset, offset + nameLen).toString('utf-8');
  offset += nameLen;

  const contactLen = data.readUInt32LE(offset);
  offset += 4;
  const contactInfo = data.slice(offset, offset + contactLen).toString('utf-8');
  offset += contactLen;

  const createdAt = Number(data.readBigInt64LE(offset));

  return {
    owner,
    organizationId,
    name,
    contactInfo,
    createdAt,
  };
};

const OrganizationsScreen: React.FC = () => {
  const {navigate, goBack} = useNavigation();

  const {connection} = useConnection();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  function getDiscriminator(name: string): Buffer {
    const hash = sha256.digest(`account:${name}`);
    return Buffer.from(hash).slice(0, 8);
  }

  useEffect(() => {
    const fetchOrganizations = async () => {
      setLoading(true);
      try {
        const discriminator = getDiscriminator('Organization');

        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: bs58.encode(discriminator),
              },
            },
          ],
        });

        const orgs = accounts.map(acc => {
          return decodeOrganization(acc.account.data);
        });

        console.log(orgs);
        setOrganizations(orgs);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations().catch(console.error);
  }, []);

  const handleBackPress = (): void => {
    goBack();
  };

  const handleRegisterOrganization = (): void => {
    navigate('RegisterOrg');
  };

  const renderOrganizationItem: ListRenderItem<Organization> = ({item}) => (
    <OrganizationCard org={item} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.gradient}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Organizations</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Register Organization Button */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegisterOrganization}
            activeOpacity={0.8}>
            <Text style={styles.registerButtonText}>Register Organization</Text>
          </TouchableOpacity>

          <View style={styles.spacer16} />

          <Text style={styles.sectionTitle}>Registered Organizations</Text>
          <View style={styles.spacer8} />

          {/* Organizations List */}
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          ) : (
            <FlatList
              data={organizations}
              renderItem={renderOrganizationItem}
              keyExtractor={item => item.name}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
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
    paddingTop: 16,
  },
  registerButton: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 8,
  },
  registerButtonText: {
    color: '#667EEA',
    fontSize: 16,
    fontWeight: '500',
  },
  spacer16: {
    height: 16,
  },
  spacer8: {
    height: 8,
  },
  spacer4: {
    height: 4,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: 20,
  },
  organizationCard: {
    width: '100%',
    marginVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 20,
  },

  organizationName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },

  contactInfo: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 16,
    marginBottom: 4,
  },

  createdAt: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
});

export default OrganizationsScreen;
