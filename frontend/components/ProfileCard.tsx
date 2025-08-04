import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

/* ─── Props ─── */
interface Stat {
  title: string;
  value: number | string;
}

interface ProfileCardProps {
  isUser: boolean;
  name: string;
  description?: string | null;
  contactInfo?: string | null;
  stats: Stat[];
}

/* ─── Component ─── */
const ProfileCard: React.FC<ProfileCardProps> = ({
  isUser,
  name,
  description,
  contactInfo,
  stats,
}) => {
  return (
    <LinearGradient
      colors={['#001F3F', '#003366', '#001F3F']}
      style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Icon
          name={isUser ? 'person' : 'business'}
          size={22}
          color="#fff"
          style={styles.icon}
        />
        <Text style={styles.title}>{name}</Text>
      </View>

      {/* Details */}
      {!isUser && (
        <>
          {description ? (
            <Text style={styles.detailText}>{description}</Text>
          ) : null}

          {contactInfo ? (
            <Text style={styles.detailText}>{contactInfo}</Text>
          ) : null}
        </>
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Stats */}
      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statRow}>
            <Text style={styles.statLabel}>{stat.title}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flexShrink: 1,
  },
  detailText: {
    fontSize: 14,
    color: '#fff',
    marginTop: 6,
    lineHeight: 20,
  },
  detailLabel: {
    color: '#A0AEC0',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#334E68',
    marginVertical: 16,
  },
  statsContainer: {
    flexDirection: 'column',
    gap: 10, // For RN >= 0.71
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 14,
    color: '#A0AEC0',
  },
  statValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

export default ProfileCard;
