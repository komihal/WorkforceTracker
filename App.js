import React, { useState } from 'react';
import { SafeAreaView, View, Text, Button } from 'react-native';

export default function App() {
  const [status, setStatus] = useState('Тестирование');

  const testConfig = () => {
    // Простые тестовые переменные
    const apiUrl = 'https://api.example.com';
    const apiToken = 'your_api_token_here';
    
    setStatus(`API_URL: ${apiUrl}\nAPI_TOKEN: ${apiToken}\n\nПриложение работает!`);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', gap:12, padding:16 }}>
        <Text style={{ fontSize:18 }}>Workforce Tracker (Тест)</Text>
        <Text style={{ textAlign: 'center', marginVertical: 20 }}>{status}</Text>
        <Button title="Тест конфигурации" onPress={testConfig} />
      </View>
    </SafeAreaView>
  );
}
