import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface AlertBannerProps {
    message: string;
    type?: 'error' | 'success' | 'info';
}

const AlertBanner: React.FC<AlertBannerProps> = ({ message, type = 'error' }) => {
    const backgroundColor =
        type === 'error' ? '#FF4C4C' : type === 'success' ? '#4CAF50' : '#2196F3';

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <Icon
                name={type === 'error' ? 'error-outline' : type === 'success' ? 'check-circle' : 'info'}
                size={20}
                color="white"
                style={styles.icon}
            />
            <Text style={styles.message}>{message}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 6,
        marginBottom: 12,
    },
    icon: {
        marginRight: 8,
    },
    message: {
        color: 'white',
        fontSize: 14,
        flexShrink: 1,
    },
});

export default AlertBanner;
