import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const SelectRoleCard = ({
    icon,
    title,
    description,
    selected,
    onPress,
}: {
    icon: string;
    title: string;
    description: string;
    selected: boolean;
    onPress: () => void;
}) => (
    <TouchableOpacity style={[styles.card, selected && styles.selectedCard]} onPress={onPress}>
        <Icon name={icon} size={40} color="#CCE6FF" />
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#004080',
        flex: 1,
        paddingTop: 24,
        paddingBottom: 24,
        paddingLeft: 8,
        paddingRight: 8,
        marginHorizontal: 8,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    selectedCard: {
        borderColor: '#00BFFF', // DeepSkyBlue for selection highlight
        borderWidth: 2,
    },
    cardTitle: {
        marginTop: 10,
        color: '#fff',
        fontSize: 18,
        fontWeight: "600"
    },
    cardDescription: {
        marginTop: 10,
        color: '#CCE6FF',
        fontSize: 12,
        fontWeight: "400"
    },
});

export default SelectRoleCard;