import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ProfileScreen from './ProfileScreen';
import FAQScreen from './FAQScreen';
import theme from '../util/theme';
import RecordsScreen from './RecordsScreen';
import { useTEEContext } from '../components/providers/TEEStateProvider';
import { ERR_UNKNOWN, PROGRAM_ID } from '../util/constants';
import { useConnection } from '../components/providers/ConnectionProvider';
import { parseTEEState } from '../api/state';
import { useToast } from '../components/providers/ToastContext';
import HomeScreen from './HomeScreen';
import { useNavigation } from '../components/providers/NavigationProvider';

const MainScreen = () => {
    const [activeTab, setActiveTab] = useState('Home');
    const { teeState, setTEEState } = useTEEContext();
    const { connection } = useConnection();
    const toast = useToast();
    const { navigate, currentScreen , selectedRole} = useNavigation();

    if (currentScreen !== 'Dashboard') {
        // Do not render MainScreen if it's not the current screen
        return null;
    }

    const [loading, setLoading] = useState<boolean>(false);

    const fetchTEEState = async () => {
        try {
            setLoading(true);
            const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
                filters: [{ dataSize: 1073 }],
            });

            for (const account of accounts) {
                const parsed = parseTEEState(account.account.data);
                setTEEState({
                    attestation: parsed.attestation,
                    isInitialized: parsed.isInitialized,
                    pubkey: parsed.pubkey,
                    signer: parsed.signer,
                });
            }
        } catch (err: any) {
            if (err.message) {
                toast.show({
                    message: err.message,
                    type: 'error',
                });
            } else {
                toast.show({
                    message: ERR_UNKNOWN,
                    type: 'error',
                });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!teeState)
            fetchTEEState()
    }, []);


    const renderScreen = () => {
        switch (activeTab) {
            case 'Home':
                return <HomeScreen />;
            case 'Records':
                return <RecordsScreen />;
            case 'Profile':
                return <ProfileScreen />;
            case 'FAQ':
                return <FAQScreen />;
            default:
                return <HomeScreen />;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>{renderScreen()}</View>

            {/* Floating + Button */}
            {selectedRole === "user" &&
                <TouchableOpacity onPress={() => navigate("Upload")}>
                    <View
                        style={styles.fab}>
                        <Icon name="add" size={36} color="white" />
                    </View>
                </TouchableOpacity>
            }


            {/* Bottom Navigation */}
            <View style={styles.bottomBar}>
                <TouchableOpacity onPress={() => setActiveTab('Home')} style={styles.tab}>
                    <Icon name="home" size={28} color={activeTab === 'Home' ? '#00d4ff' : '#aaa'} />
                    <Text style={[styles.label, activeTab === 'Home' && styles.activeLabel]}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveTab('Records')} style={styles.tab}>
                    <Icon name="save" size={28} color={activeTab === 'Records' ? '#00d4ff' : '#aaa'} />
                    <Text style={[styles.label, activeTab === 'Records' && styles.activeLabel]}>{selectedRole === "user" ? "My Records" : "Records"}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveTab('FAQ')} style={styles.tab}>
                    <Icon name="help-outline" size={28} color={activeTab === 'FAQ' ? '#00d4ff' : '#aaa'} />
                    <Text style={[styles.label, activeTab === 'FAQ' && styles.activeLabel]}>FAQ</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveTab('Profile')} style={styles.tab}>
                    <Icon name="person" size={28} color={activeTab === 'Profile' ? '#00d4ff' : '#aaa'} />
                    <Text style={[styles.label, activeTab === 'Profile' && styles.activeLabel]}>Profile</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// Styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    content: {
        flex: 1,
    },
    screen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 70,
        backgroundColor: '#001F3F',
        paddingHorizontal: 8,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        elevation: 8,
    },
    tab: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    label: {
        fontSize: 12,
        color: '#aaa',
    },
    activeLabel: {
        color: '#00d4ff',
    },
    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.colors.primaryAction,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,

        // Android elevation
        elevation: 10,

        // iOS shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    spacer: {
        width: 70,
    },
});

export default MainScreen;
