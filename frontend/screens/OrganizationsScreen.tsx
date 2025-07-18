import React from 'react';
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
import { useNavigation } from '../components/providers/NavigationProvider';


interface Organization {
    id: string;
    name: string;
    contactInfo: string;
    registeredDate: string;
}

interface OrganizationCardProps {
    org: Organization;
}

const OrganizationCard: React.FC<OrganizationCardProps> = ({ org }) => {
    return (
        <View style={styles.organizationCard}>
            <Text style={styles.organizationName}>🏥 {org.name}</Text>
            <View style={styles.spacer4} />
            <Text style={styles.contactInfo}>📞 {org.contactInfo}</Text>
            <Text style={styles.registeredDate}>📅 Registered on {org.registeredDate}</Text>
        </View>
    );
};

const OrganizationsScreen: React.FC = () => {

    const { navigate, goBack } = useNavigation();

    const mockOrganizations: Organization[] = [
        {
            id: '1',
            name: 'Apollo Hospitals',
            contactInfo: 'apollo@example.com',
            registeredDate: '2023-01-12',
        },
        {
            id: '2',
            name: 'Fortis Health',
            contactInfo: 'contact@fortis.com',
            registeredDate: '2022-07-08',
        },
        {
            id: '3',
            name: 'CloudNine Care',
            contactInfo: 'hello@cloudnine.com',
            registeredDate: '2024-03-20',
        },
    ];

    const handleBackPress = (): void => {
        goBack();
    };

    const handleRegisterOrganization = (): void => {
        navigate('RegisterOrg')
    };

    const renderOrganizationItem: ListRenderItem<Organization> = ({ item }) => (
        <OrganizationCard org={item} />
    );

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#667EEA', '#764BA2']}
                style={styles.gradient}
            >
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
                        activeOpacity={0.8}
                    >
                        <Text style={styles.registerButtonText}>Register Organization</Text>
                    </TouchableOpacity>

                    <View style={styles.spacer16} />

                    <Text style={styles.sectionTitle}>Registered Organizations</Text>
                    <View style={styles.spacer8} />

                    {/* Organizations List */}
                    <FlatList
                        data={mockOrganizations}
                        renderItem={renderOrganizationItem}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.listContainer}
                    />
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
        marginVertical: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
    },
    organizationName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    contactInfo: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        marginTop: 4,
    },
    registeredDate: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 13,
    },
});


export default OrganizationsScreen;
