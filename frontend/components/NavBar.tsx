import { StyleSheet, Text, View } from "react-native";
import Icon from 'react-native-vector-icons/MaterialIcons';


export const NavBar = () => {
    return (
        <View style={styles.navBar}>
            <Text style={styles.navTitle}>HealthLock</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    navBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 22,
        paddingHorizontal: 22,
    },

    navTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
});