import React, {useRef, useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {useConnection} from '../components/providers/ConnectionProvider';
import {PROGRAM_ID} from '../util/constants';
import {Buffer} from 'buffer';
import {sha256} from 'js-sha256';
import bs58 from 'bs58';
import theme from '../util/theme';

const {width: screenWidth} = Dimensions.get('window');

interface InfoSlide {
  id: number;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  gradient: string[];
}

interface InfoCarouselProps {
  programId: string;
}

const infoSlides: InfoSlide[] = [
  {
    id: 1,
    icon: 'security',
    iconColor: '#00d4ff',
    title: 'TEE Powered',
    description:
      'Your health records are encrypted and decrypted using Trusted Execution Environment at hardware level for maximum security',
    gradient: ['rgba(0, 212, 255, 0.2)', 'rgba(0, 212, 255, 0.05)'],
  },
  {
    id: 2,
    icon: 'cloud-upload',
    iconColor: '#4CAF50',
    title: 'IPFS Storage',
    description:
      'Encrypted data is stored on decentralized IPFS network, ensuring global accessibility and redundancy',
    gradient: ['rgba(76, 175, 80, 0.2)', 'rgba(76, 175, 80, 0.05)'],
  },
  {
    id: 3,
    icon: 'link',
    iconColor: '#FF9800',
    title: 'Blockchain Control',
    description:
      'Solana blockchain manages access permissions and stores IPFS identifiers for transparent control',
    gradient: ['rgba(255, 152, 0, 0.2)', 'rgba(255, 152, 0, 0.05)'],
  },
  {
    id: 4,
    icon: 'verified-user',
    iconColor: '#9C27B0',
    title: 'Your Control',
    description:
      'Grant or revoke access to healthcare providers instantly. Your data, your decisions, your privacy',
    gradient: ['rgba(156, 39, 176, 0.2)', 'rgba(156, 39, 176, 0.05)'],
  },
];

const InfoCarousel: React.FC<InfoCarouselProps> = () => {
  const {connection} = useConnection();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCarouselVisible, setIsCarouselVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const programId = PROGRAM_ID;

  const [accountCounts, setAccountCounts] = useState({
    users: 0,
    records: 0,
    organizations: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAccountCounts = async () => {
    try {
      setLoading(true);

      const getDiscriminator = (name: string): Buffer => {
        const hash = sha256.digest(`account:${name}`);
        return Buffer.from(hash).subarray(0, 8);
      };

      const discriminator = getDiscriminator('Organization');
      const discriminator2 = getDiscriminator('UserVault');
      const discriminator3 = getDiscriminator('HealthRecord');
      const [organizationAccounts, userAccounts, recordAccounts] =
        await Promise.all([
          connection.getProgramAccounts(programId, {
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: bs58.encode(discriminator),
                },
              },
            ],
            dataSlice: {
              offset: 0,
              length: 0,
            },
          }),

          connection.getProgramAccounts(programId, {
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: bs58.encode(discriminator2),
                },
              },
            ],
            dataSlice: {
              offset: 0,
              length: 0,
            },
          }),

          connection.getProgramAccounts(programId, {
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: bs58.encode(discriminator3),
                },
              },
            ],
            dataSlice: {
              offset: 0,
              length: 0,
            },
          }),
        ]);

      setAccountCounts({
        organizations: organizationAccounts.length,
        users: userAccounts.length,
        records: recordAccounts.length,
      });
    } catch (error) {
      console.error('Error fetching account counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountCounts();

    const interval = setInterval(fetchAccountCounts, 30000);

    return () => clearInterval(interval);
  }, [programId]);

  useEffect(() => {
    if (!isCarouselVisible) return;

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % infoSlides.length;
      scrollToIndex(nextIndex);
    }, 4000);

    return () => clearInterval(interval);
  }, [currentIndex, isCarouselVisible]);

  const scrollToIndex = (index: number) => {
    if (scrollViewRef.current) {
      // Animate current slide out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Scroll to next slide
        scrollViewRef.current?.scrollTo({
          x: index * screenWidth,
          animated: true,
        });
        setCurrentIndex(index);

        // Animate new slide in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const index = Math.round(contentOffset.x / screenWidth);
    if (index !== currentIndex && index >= 0 && index < infoSlides.length) {
      setCurrentIndex(index);
    }
  };

  const renderSlide = (slide: InfoSlide, index: number) => (
    <Animated.View
      key={slide.id}
      style={[
        styles.slide,
        {
          opacity: fadeAnim,
          transform: [{scale: scaleAnim}],
        },
      ]}>
      <LinearGradient
        colors={slide.gradient}
        style={styles.slideGradient}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={styles.slideContent}>
          {/* Icon Container */}
          <View style={[styles.iconContainer, {borderColor: slide.iconColor}]}>
            <Icon name={slide.icon} size={48} color={slide.iconColor} />
          </View>

          {/* Title */}
          <Text style={styles.slideTitle}>{slide.title}</Text>

          {/* Description */}
          <Text style={styles.slideDescription}>{slide.description}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  const renderStatsCompact = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Icon name="people" size={28} color="#00d4ff" />
          <Text style={styles.statNumber}>
            {loading ? '--' : accountCounts.users.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Total Users&nbsp;&nbsp;</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="description" size={28} color="#4CAF50" />
          <Text style={styles.statNumber}>
            {loading ? '--' : accountCounts.records.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Total&nbsp;Records</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="business" size={28} color="#FF9800" />
          <Text style={styles.statNumber}>
            {loading ? '--' : accountCounts.organizations.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Organizations</Text>
        </View>
      </View>
    </View>
  );

  const renderStatsExpanded = () => (
    <View style={styles.statsExpandedContainer}>
      <View style={styles.statRowCard}>
        <View style={styles.statRowIconContainer}>
          <Icon name="people" size={32} color="#00d4ff" />
        </View>
        <View style={styles.statRowContent}>
          <Text style={styles.statRowNumber}>
            {loading ? '--' : accountCounts.users.toLocaleString()}
          </Text>
          <Text style={styles.statRowLabel}>Users Registered</Text>
          <Text style={styles.statRowDescription}>
            Active users secured by Health Lock
          </Text>
        </View>
      </View>

      <View style={styles.statRowCard}>
        <View style={styles.statRowIconContainer}>
          <Icon name="description" size={32} color="#4CAF50" />
        </View>
        <View style={styles.statRowContent}>
          <Text style={styles.statRowNumber}>
            {loading ? '--' : accountCounts.records.toLocaleString()}
          </Text>
          <Text style={styles.statRowLabel}>Records Uploaded</Text>
          <Text style={styles.statRowDescription}>
            Health records safely stored on IPFS
          </Text>
        </View>
      </View>

      <View style={styles.statRowCard}>
        <View style={styles.statRowIconContainer}>
          <Icon name="business" size={32} color="#FF9800" />
        </View>
        <View style={styles.statRowContent}>
          <Text style={styles.statRowNumber}>
            {loading ? '--' : accountCounts.organizations.toLocaleString()}
          </Text>
          <Text style={styles.statRowLabel}>Organizations</Text>
          <Text style={styles.statRowDescription}>
            Healthcare providers using the platform
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with Toggle */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>How Health Lock Works</Text>
            <Text style={styles.headerSubtitle}>
              Secure • Decentralized • Your Control
            </Text>
          </View>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setIsCarouselVisible(!isCarouselVisible)}>
            <Icon
              name={isCarouselVisible ? 'expand-less' : 'expand-more'}
              size={28}
              color="rgba(0, 212, 255, 0.5)"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Carousel (collapsible) */}
      {isCarouselVisible && (
        <>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            style={styles.scrollView}>
            {infoSlides.map((slide, index) => renderSlide(slide, index))}
          </ScrollView>

          {/* Dot Indicators */}
          <View style={styles.dotContainer}>
            {infoSlides.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => scrollToIndex(index)}
                style={[
                  styles.dot,
                  index === currentIndex
                    ? styles.activeDot
                    : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        </>
      )}

      {/* Stats - Conditional Layout */}
      {isCarouselVisible ? renderStatsCompact() : renderStatsExpanded()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    width: 36,
    height: 36,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.15)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    opacity: 0.8,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  scrollView: {
    maxHeight: 280,
  },
  slide: {
    width: screenWidth,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  slideGradient: {
    flex: 1,
    borderRadius: 20,
    padding: 40,
    minHeight: 250,
    justifyContent: 'center',
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 75,
    height: 75,
    borderRadius: 50,
    padding: 8,
    borderWidth: 2,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  slideTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  stepIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#00d4ff',
    width: 24,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statsContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(20px)',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  statsExpandedContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(20px)',
  },
  statRowIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  statRowContent: {
    flex: 1,
  },

  statRowNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  statRowLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 2,
  },
  statRowDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
  },
});

export default InfoCarousel;
