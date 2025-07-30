import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation} from '../components/providers/NavigationProvider';
// import DateTimePicker from '@react-native-community/datetimepicker';

// Define your navigation stack parameter list
type RootStackParamList = {
  RegisterOrg: undefined;
  Organizations: undefined;
  // Add other screens here
};

const RegisterOrganizationScreen: React.FC = () => {
  const {navigate, goBack} = useNavigation();

  const [name, setName] = useState<string>('');
  const [contactInfo, setContactInfo] = useState<string>('');
  const [registeredDate, setRegisteredDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const handleBackPress = (): void => {
    goBack();
  };

  const handleRegister = (): void => {
    // Save logic (store, validate, etc.)
    // You can add validation here
    console.log('Registering organization:', {
      name,
      contactInfo,
      registeredDate,
    });
    // navigation.goBack();
  };

  const showDatePickerDialog = (): void => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, date?: Date): void => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      const formattedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      setRegisteredDate(formattedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.gradient}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Register Organization</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter organization name"
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
            />
          </View>

          {/* Contact Info Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Contact Info</Text>
            <TextInput
              style={styles.textInput}
              value={contactInfo}
              onChangeText={setContactInfo}
              placeholder="Enter contact information"
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
            />
          </View>

          {/* Registered Date Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Registered Date</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={showDatePickerDialog}
              activeOpacity={0.8}>
              <Text style={styles.dateText}>
                {registeredDate || 'Select registration date'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.spacer24} />

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleRegister}
            activeOpacity={0.8}>
            <Text style={styles.submitButtonText}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker */}
        {/* {showDatePicker && (
                    <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                    />
                )} */}
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#667EEA',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  inputContainer: {
    marginVertical: 8,
  },
  inputLabel: {
    color: 'white',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dateInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dateText: {
    fontSize: 16,
    color: 'white',
  },
  spacer24: {
    height: 24,
  },
  submitButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#667EEA',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RegisterOrganizationScreen;
