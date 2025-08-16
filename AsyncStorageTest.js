import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Простой тест AsyncStorage
export const testAsyncStorage = async () => {
  try {
    // Тест записи
    await AsyncStorage.setItem('test_key', 'test_value');
    console.log('✅ AsyncStorage write test passed');
    
    // Тест чтения
    const value = await AsyncStorage.getItem('test_key');
    if (value === 'test_value') {
      console.log('✅ AsyncStorage read test passed');
    } else {
      console.log('❌ AsyncStorage read test failed');
    }
    
    // Тест удаления
    await AsyncStorage.removeItem('test_key');
    const deletedValue = await AsyncStorage.getItem('test_key');
    if (deletedValue === null) {
      console.log('✅ AsyncStorage delete test passed');
    } else {
      console.log('❌ AsyncStorage delete test failed');
    }
    
    Alert.alert('AsyncStorage Test', 'All tests completed. Check console for results.');
    
  } catch (error) {
    console.error('AsyncStorage test error:', error);
    Alert.alert('AsyncStorage Test Error', error.message);
  }
};

export default testAsyncStorage;
