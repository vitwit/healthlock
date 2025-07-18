import React from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../components/providers/NavigationProvider';

const { width } = Dimensions.get('window');

const mockRecords = [
    {
        id: 'REC123',
        title: 'Blood Report',
        description: 'Blood test from April',
        createdAt: '2024-04-05',
        accessGrantedTo: 2,
    },
    {
        id: 'REC124',
        title: 'MRI Scan',
        description: 'MRI brain scan results',
        createdAt: '2024-03-18',
        accessGrantedTo: 1,
    },
    {
        id: 'REC125',
        title: 'Prescription',
        description: 'General medication list',
        createdAt: '2024-02-22',
        accessGrantedTo: 3,
    },
];

const ViewRecordsScreen = () => {
    const { navigate, goBack } = useNavigation();

    const renderItem = ({ item }: { item: RecordType }) => <RecordCard record={item} navigate={navigate} />;

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.gradient}>
                {/* Top Bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
                        <Icon name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.topBarTitle}>View Records</Text>
                </View>

                {/* Content */}
                <FlatList
                    contentContainerStyle={styles.listContainer}
                    data={mockRecords}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />
            </LinearGradient>
        </SafeAreaView>
    );
};

const RecordCard = ({ record, navigate }: { record: RecordType, navigate: any }) => {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>📄 {record.title}</Text>
            <Text style={styles.cardSub}>🆔 ID: {record.id}</Text>
            <Text style={styles.cardSub}>🕒 Created At: {record.createdAt}</Text>
            <Text style={styles.cardSub}>🔐 Access Granted To: {record.accessGrantedTo}</Text>
            <Text style={styles.cardDesc}>📝 {record.description}</Text>

            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button}>
                    <Text style={styles.buttonText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button}
                    onPress={() => navigate('ShareRecord', { record })}
                >
                    <Text style={styles.buttonText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.deleteButton]}>
                    <Text style={[styles.buttonText, { color: 'red' }]}>Delete</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

type RecordType = {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    accessGrantedTo: number;
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
