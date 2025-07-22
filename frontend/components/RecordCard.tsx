import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export type RecordType = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  accessGrantedTo: number;
};

const RecordCard = ({
  record,
  navigate,
  onDelete,
}: {
  record: RecordType;
  navigate: any;
  onDelete: (recordId: string, title: string) => void;
}) => {
  const formattedDate = new Date(record.createdAt * 1000).toLocaleDateString();

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
        <TouchableOpacity style={styles.button}>
          <Icon name="visibility" size={16} color="#fff" />
          <Text style={styles.buttonText}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigate('ShareRecord', {record})}>
          <Icon name="share" size={16} color="#fff" />
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => {
            onDelete(record.id, record.title);
          }}>
          <Icon name="delete" size={16} color="red" />
          <Text style={[styles.buttonText, {color: 'red'}]}>Delete</Text>
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
    shadowOffset: {width: 0, height: 1},
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
