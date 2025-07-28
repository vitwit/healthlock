import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import theme from "../util/theme";
import { NavBar } from "../components/NavBar";
import { useNavigation } from "../components/providers/NavigationProvider";
import { useCallback, useEffect, useState } from "react";
import { getOrganization, Organization } from "../api/organization";
import { useToast } from "../components/providers/ToastContext";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useAuthorization } from "../components/providers/AuthorizationProvider";
import { useConnection } from "../components/providers/ConnectionProvider";
import { ERR_UNKNOWN, PROGRAM_ID } from "../util/constants";
import { encodeAnchorString } from "./DashboardScreen";
import { Buffer } from "buffer";
import {
    transact,
    Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

const HomeScreen = () => {
    const { selectedRole } = useNavigation();
    const { selectedAccount, deauthorizeSession } = useAuthorization();
    const { connection } = useConnection();
    const { authorizeSession } = useAuthorization();

    const toast = useToast();

    const [publicKey, setPublicKey] = useState<PublicKey>();
    useEffect(() => {
        setPublicKey(selectedAccount?.publicKey);
    }, [selectedAccount]);


    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [organizationLoading, setOrganizationLoading] =
        useState<boolean>(false);
    const [organization, setOrganization] = useState<Organization | undefined>(
        undefined,
    );
    const [registeredOrganization, setRegisteredOrganization] =
        useState<boolean>(false);


    const registerOrganizationTransaction = useCallback(
        async (name: string, description: string, contactInfo: string) => {
            return await transact(async (wallet: Web3MobileWallet) => {
                try {
                    const [authorizationResult, latestBlockhash] = await Promise.all([
                        authorizeSession(wallet),
                        connection.getLatestBlockhash(),
                    ]);

                    const userPubkey = authorizationResult.publicKey;

                    const [organizationPDA] = await PublicKey.findProgramAddress(
                        [Buffer.from('organization'), userPubkey.toBuffer()],
                        PROGRAM_ID,
                    );

                    const discriminator = Buffer.from([
                        183, 29, 228, 76, 94, 9, 196, 137,
                    ]);

                    const data = Buffer.concat([
                        discriminator,
                        encodeAnchorString(name),
                        encodeAnchorString(description),
                        encodeAnchorString(contactInfo),
                    ]);
                    const keys = [
                        { pubkey: organizationPDA, isSigner: false, isWritable: true },
                        { pubkey: userPubkey, isSigner: true, isWritable: true },
                        {
                            pubkey: SystemProgram.programId,
                            isSigner: false,
                            isWritable: false,
                        },
                    ];

                    const ix = new TransactionInstruction({
                        programId: PROGRAM_ID,
                        keys,
                        data,
                    });

                    const tx = new Transaction({
                        ...latestBlockhash,
                        feePayer: userPubkey,
                    });

                    tx.add(ix);

                    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
                    const txid = await connection.sendRawTransaction(
                        signedTxs[0].serialize(),
                    );

                    await connection.confirmTransaction(txid, 'confirmed');

                    toast.show({
                        type: 'success',
                        message: `Successfully registered`,
                    });

                    return signedTxs[0];
                } catch (error: any) {
                    if (error && error.message) {
                        toast.show({
                            type: 'error',
                            message: error.message,
                        });
                    } else if (error.response) {
                        toast.show({
                            type: 'error',
                            message: JSON.stringify(error.response),
                        });
                    } else {
                        toast.show({
                            type: 'error',
                            message: ERR_UNKNOWN,
                        });
                    }
                }
            });
        },
        [authorizeSession, connection],
    );

    const [registerOrganizationLoading, setRegisterOrganizationLoading] =
        useState<boolean>(false);



    const fetchOrganization = async () => {
        if (!publicKey) {
            console.log('Wallet not connected. Pubkey not found!');
            return;
        }
        try {
            console.log("fetching organization")
            setOrganizationLoading(true);
            const result = await getOrganization(connection, publicKey);
            if (result && result.name.length > 0) {
                setOrganization(result);
                setRegisteredOrganization(true);
            } else {
                setRegisteredOrganization(false);
            }
            console.log("successfull fetched1")
        } catch (error: any) {
            if (error && error.message === 'Organization account not found') {
                setRegisteredOrganization(false);
            } else {
                toast.show({ type: 'error', message: error?.message || ERR_UNKNOWN });
            }
        } finally {
            console.log("successfull fetched2")
            setOrganizationLoading(false);
        }
    };

    const onClickRegisterOrg = async () => {
        if (name.trim().length <= 3 || description.trim().length <= 3 || contactInfo.trim().length <= 3) {
            toast.show({
                message: "Invalid input data",
                type: "error"
            })
            return;
        }
        try {
            setRegisterOrganizationLoading(true);
            await registerOrganizationTransaction(name.trim(), description.trim(), contactInfo.trim());
            await fetchOrganization();
        } catch (err: any) {
        } finally {
            setRegisterOrganizationLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={theme.colors.backgroundGradient}
            style={styles.container}
        >
            <NavBar />
            <View style={styles.wrapper}>
                {
                    (selectedRole === "organization" && !organizationLoading && !registeredOrganization) && (
                        <View style={styles.registrationForm}>
                            <Text style={styles.formHeading}>
                                Your organization is not registered. Please create an
                                account to continue using the application.
                            </Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Name"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                maxLength={50}
                                value={name}
                                onChangeText={setName}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Description"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                maxLength={100}
                                value={description}
                                onChangeText={setDescription}
                            />
                            <TextInput
                                style={styles.input}
                                multiline={true}
                                numberOfLines={3}
                                placeholder="Contact Info"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                maxLength={255}
                                value={contactInfo}
                                onChangeText={setContactInfo}
                            />

                            <TouchableOpacity
                                style={styles.registerButton}
                                onPress={() => {
                                    onClickRegisterOrg();
                                }}>
                                <Text style={styles.registerButtonText}>Register</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }
            </View>
        </LinearGradient>
    );
}


export default HomeScreen;


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    wrapper: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    registrationForm: {
        flex: 1,
        padding: 20,
        borderRadius: 10,
        marginTop: 24,
    },
    formHeading: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
    },
    registerButton: {
        backgroundColor: '#004080',
        padding: 12,
        borderRadius: 8,
    },
    registerButtonText: {
        textAlign: 'center',
        color: '#fff',
        fontWeight: 'bold',
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        marginBottom: 12,
    },
})