import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation} from '../components/providers/NavigationProvider';
import {useConnection} from '../components/providers/ConnectionProvider';
import {PublicKey} from '@solana/web3.js';
import {sha256} from 'js-sha256';
import bs58 from 'bs58';
import {PROGRAM_ID} from '../util/constants';
import {useAuthorization} from '../components/providers/AuthorizationProvider';

type RecordType = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  accessGrantedTo: number;
};

const ViewRecordsScreen = () => {
  const {navigate, goBack} = useNavigation();
  const {connection} = useConnection();
  const {accounts} = useAuthorization();

  const [publicKey, setPublicKey] = useState<PublicKey>();
  useEffect(() => {
    if (accounts && accounts?.length > 0) {
      const p = accounts[0].publicKey;
      setPublicKey(p);
      setPublicKey(
        new PublicKey('As5gHp6yKvGBNvAtfPdVJns2tdYgRgmajruJLQWo9Aov'),
      );
    }
  }, [accounts]);

  const [records, setRecords] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  function getDiscriminator(name: string): Buffer {
    const hash = sha256.digest(`account:${name}`);
    return Buffer.from(hash).slice(0, 8);
  }

  useEffect(() => {
    const fetchRecords = async () => {
      console.log('🔍 Fetching records...');
      if (!publicKey) {
        console.log('inside');
        return;
      }

      setLoading(true);

      try {
        const discriminator = getDiscriminator('HealthRecord');

        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: bs58.encode(discriminator),
              },
            },
            {
              memcmp: {
                offset: 8, // After discriminator, owner pubkey starts
                bytes: publicKey.toBase58(),
              },
            },
          ],
        });

        console.log('✅ Accounts found:', accounts.length);

        const parsedRecords: RecordType[] = [];

        for (const acc of accounts) {
          const data = acc.account.data;
          const totalLength = data.length;
          let offset = 8; // Skip discriminator

          try {
            console.log('📦 Record buffer length:', totalLength);

            const owner = new PublicKey(data.slice(offset, offset + 32));
            console.log('👤 Owner:', owner.toBase58());
            offset += 32;

            const record_id = Number(data.readBigUInt64LE(offset));
            console.log('🔢 Record ID:', record_id);
            offset += 8;

            // Skip encrypted_data
            const encLen = data.readUInt32LE(offset);
            offset += 4;
            offset += encLen;

            // Access list
            let accessListLen = 0;
            const accessListStart = offset;

            try {
              accessListLen = data.readUInt32LE(offset);
              offset += 4;

              const expectedAccessSize = accessListLen * (32 + 8);
              if (offset + expectedAccessSize > totalLength) {
                console.warn('⚠️ Skipping corrupt access list');
                offset = accessListStart + 4; // Only skip the length field
                accessListLen = 0;
              } else {
                offset += expectedAccessSize;
              }
            } catch (e) {
              console.warn('⚠️ Failed to read access list — skipping');
              offset = accessListStart + 4;
              accessListLen = 0;
            }

            // mime_type
            const mimeLen = data.readUInt32LE(offset);
            offset += 4;
            offset += mimeLen;

            // file_size
            const fileSize = Number(data.readBigUInt64LE(offset));
            offset += 8;

            // created_at
            const createdAt = Number(data.readBigInt64LE(offset));
            offset += 8;

            // title
            const titleLen = data.readUInt32LE(offset);
            offset += 4;
            if (offset + titleLen > totalLength) {
              console.log(
                '📏 titleLen =',
                titleLen,
                '| remaining =',
                totalLength - offset,
              );
              throw new Error('Title exceeds buffer');
            }
            const title = data
              .slice(offset, offset + titleLen)
              .toString('utf-8');
            offset += titleLen;

            // description
            const descLen = data.readUInt32LE(offset);
            offset += 4;
            if (offset + descLen > totalLength) {
              console.log(
                '📏 descLen =',
                descLen,
                '| remaining =',
                totalLength - offset,
              );
              throw new Error('Description exceeds buffer');
            }
            const description = data
              .slice(offset, offset + descLen)
              .toString('utf-8');
            offset += descLen;

            parsedRecords.push({
              id: `REC${record_id}`,
              title,
              description,
              createdAt,
              accessGrantedTo: accessListLen,
            });
          } catch (err) {
            console.error('❌ Failed to parse a record:', err.message);
          }
        }

        console.log('📃 Parsed records:', parsedRecords);
        setRecords(parsedRecords);
      } catch (err) {
        console.error('Failed to fetch health records:', err);
      } finally {
        console.log('🔁 Done loading');
        setLoading(false);
      }
    };

    fetchRecords();
  }, [publicKey]);

  const renderItem = ({item}: {item: RecordType}) => (
    <RecordCard record={item} navigate={navigate} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.gradient}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>View Records</Text>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="white" />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.listContainer}
            data={records}
            keyExtractor={item => item.id}
            renderItem={renderItem}
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

const RecordCard = ({
  record,
  navigate,
}: {
  record: RecordType;
  navigate: any;
}) => {
  const formattedDate = new Date(record.createdAt * 1000).toLocaleDateString();

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>📄 {record.title}</Text>
      <Text style={styles.cardSub}>🆔 ID: {record.id}</Text>
      <Text style={styles.cardSub}>🕒 Created At: {formattedDate}</Text>
      <Text style={styles.cardSub}>
        🔐 Access Granted To: {record.accessGrantedTo}
      </Text>
      <Text style={styles.cardDesc}>📝 {record.description}</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigate('ShareRecord', {record})}>
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.deleteButton]}>
          <Text style={[styles.buttonText, {color: 'red'}]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Styles: (unchanged, add loader)
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
    backgroundColor: '#667EEA',
    padding: 16,
  },
  backButton: {
    paddingRight: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  listContainer: {
    padding: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 6,
  },
  cardSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginBottom: 2,
  },
  cardDesc: {
    marginTop: 6,
    color: 'white',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
  },
  deleteButton: {
    borderColor: 'red',
  },
});

export default ViewRecordsScreen;
