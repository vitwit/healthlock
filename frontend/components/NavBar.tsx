import {StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export const NavBar = () => {
  return (
    <View style={styles.navBar}>
      <Text style={styles.navTitle}>HealthLock</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 22,
    paddingHorizontal: 20,
  },

  navTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
});
