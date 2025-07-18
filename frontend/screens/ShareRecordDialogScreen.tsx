import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../components/providers/NavigationProvider';

type OrgType = {
    id: string;
    name: string;
    type: string;
};

const organizations: OrgType[] = [
    { id: 'org1', name: 'City General Hospital', type: 'Hospital • Verified ✓' },
    { id: 'org2', name: 'MedLab Diagnostics', type: 'Laboratory • Verified ✓' },
    { id: 'org3', name: 'CarePlus Clinic', type: 'Clinic • Verified ✓' },
];

const ShareRecordDialogScreen = () => {
    const { goBack } = useNavigation();
    const [selectedOrgs, setSelectedOrgs] = useState<{ [key: string]: boolean }>({
        org1: true,
        org2: false,
        org3: false,
    });

    const toggleOrg = (id: string) => {
        setSelectedOrgs((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleShare = () => {
        const selected = organizations.filter((org) => selectedOrgs[org.id]);
        console.log('Sharing with:', selected.map((o) => o.name));
        // Trigger backend share logic here
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.gradient}>
                {/* Header */}
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={goBack} style={styles.backButton}>
                        <Icon name="close" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.topBarTitle}>Share Health Record</Text>
                </View>

                {/* Record Info */}
                <View style={styles.recordBox}>
                    <Text style={styles.recordTitle}>📄 Blood Test Results</Text>
                </View>

                {/* Org List */}
                <ScrollView contentContainerStyle={styles.orgList}>
                    {organizations.map((org) => (
                        <TouchableOpacity
                            key={org.id}
                            style={styles.orgRow}
                            onPress={() => toggleOrg(org.id)}
                        >
                            <Icon
                                name={
                                    selectedOrgs[org.id] ? 'check-box' : 'check-box-outline-blank'
                                }
                                size={22}
                                color="white"
                                style={styles.checkbox}
                            />
                            <View>
                                <Text style={styles.orgName}>{org.name}</Text>
                                <Text style={styles.orgType}>{org.type}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Share Button */}
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <Text style={styles.shareButtonText}>🔗 Share Selected Records</Text>
                </TouchableOpacity>
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
        padding: 16,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backButton: {
        marginRight: 10,
    },
    topBarTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: 'white',
    },
    recordBox: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        borderRadius: 10,
        marginBottom: 20,
    },
    recordTitle: {
        fontSize: 16,
        color: 'white',
        fontWeight: '500',
    },
    orgList: {
        paddingBottom: 20,
    },
    orgRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    checkbox: {
        marginRight: 12,
        marginTop: 2,
    },
    orgName: {
        fontSize: 16,
        color: 'white',
        fontWeight: '600',
    },
    orgType: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
    },
    shareButton: {
        backgroundColor: 'white',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    shareButtonText: {
        color: '#764BA2',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default ShareRecordDialogScreen;
