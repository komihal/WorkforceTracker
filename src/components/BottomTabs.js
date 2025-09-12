import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function BottomTabs({ current, onChange }) {
  const tabs = [
    { key: 'main', title: 'Главная' },
    { key: 'stats', title: 'Статистика' },
    { key: 'profile', title: 'Профиль' },
  ];
  return (
    <View style={styles.wrap}>
      {tabs.map(t => {
        const isDisabled = t.key !== 'main';
        const onPress = () => { if (!isDisabled) onChange(t.key); };
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, isDisabled && styles.tabDisabled]}
            onPress={onPress}
            disabled={isDisabled}
            accessibilityState={{ disabled: isDisabled }}
          >
            <Text style={[styles.tabText, current===t.key && styles.tabTextActive, isDisabled && styles.tabTextDisabled]}>
              {t.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    paddingVertical: 14,
    paddingBottom: 18,
    justifyContent: 'space-around',
  },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  tabText: { color: '#8e8e93', fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  tabDisabled: { opacity: 0.6 },
  tabTextDisabled: { color: '#3a3a3c' },
});


