import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface StatsCardProps {
  title: string;
  description: string;
  iconName: string;
  onPress: () => void;
}

const StatsCard = ({ title, description, iconName, onPress }: StatsCardProps) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Icon name={iconName} size={36} color="#fff" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  description: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default StatsCard;
