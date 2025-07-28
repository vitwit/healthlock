import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NavBar } from '../components/NavBar';
import theme from '../util/theme';

const faqs = [
    {
        question: 'What does HealthLock do?',
        answer:
            'HealthLock helps restore privacy, control, and savings to healthcare. It audits medical bills, helps recover costs, and protects against medical fraud and overbilling.',
    },
    {
        question: 'How does HealthLock work?',
        answer:
            'HealthLock syncs with your insurance and monitors your medical claims. It detects anomalies, flags overbilling, and optionally negotiates with providers.',
    },
    {
        question: 'Is HealthLock built on blockchain?',
        answer:
            'Yes. HealthLock is built on the Solana blockchain for scalability, transparency, and performance.',
    },
    {
        question: 'Where is my data stored?',
        answer:
            'Your health documents are encrypted and stored securely on IPFS (InterPlanetary File System), using TEE (Trusted Execution Environment) generated encryption keys.',
    },
    {
        question: 'Can I store documents like PDFs and images?',
        answer:
            'Yes, you can securely store medical records, PDFs, and image files in encrypted form, accessible only by you.',
    },
    {
        question: 'Is there a subscription or pricing?',
        answer:
            'No, HealthLock is free to use. There are no monthly or subscription fees.',
    },
    {
        question: 'Is HealthLock secure?',
        answer:
            'Absolutely. HealthLock uses TEE-based encryption, Solana blockchain immutability, and end-to-end data protection to keep your information safe.',
    },
];

const FAQScreen = () => {
    const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null);

    return (
        <LinearGradient colors={theme.colors.backgroundGradient} style={styles.container}>
            <NavBar/>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Frequently Asked Questions</Text>
                {faqs.map((item, idx) => (
                    <View key={idx} style={styles.card}>
                        <TouchableOpacity
                            onPress={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                            style={styles.questionRow}
                        >
                            <Text style={styles.question}>{item.question}</Text>
                            <Icon
                                name={expandedIdx === idx ? 'expand-less' : 'expand-more'}
                                size={24}
                                color="#fff"
                            />
                        </TouchableOpacity>

                        {expandedIdx === idx && <Text style={styles.answer}>{item.answer}</Text>}

                    </View>
                ))}
                <Text style={styles.version}>v1.0.0</Text>
            </ScrollView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: {
        padding: 24,
        paddingTop: 36,
        paddingBottom: 60,
    },
    title: {
        fontSize: 16,
        color: theme.colors.textPrimary,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    question: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    answer: {
        marginTop: 8,
        fontSize: 16,
        color: theme.colors.textPrimary,
        lineHeight: 22,
    },
    version: {
        fontSize: 12,
        color: '#ccc',
        opacity: 0.7,
        textAlign: 'center',
        marginTop: 30,
    },
    questionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

});

export default FAQScreen;
