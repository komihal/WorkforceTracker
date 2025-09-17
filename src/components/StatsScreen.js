import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { API_CONFIG } from '../config/api';

export default function StatsScreen({ userId }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [monthlyApproved, setMonthlyApproved] = useState(null);
  const [monthlyAppCount, setMonthlyAppCount] = useState(null);
  const [monthlySuspicious, setMonthlySuspicious] = useState(null);

  useEffect(() => {
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const getMonthRange = (offset) => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(endDate)}`;
      return { start, end };
    };

    const fetchStats = async () => {
      try {
        if (!userId) return;
        const { start, end } = getMonthRange(monthOffset);
        const qs = `?user_id=${userId}&from=${start}&to=${end}`;
        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WORKSHIFTS}${qs}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_CONFIG.API_TOKEN}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        let approved = 0, appCount = 0, suspicious = 0;
        for (const x of list) {
          const status = (x.status || x.shift_status || '').toString().toLowerCase();
          const isApproved = status.includes('approved') || status.includes('normal') || status.includes('утверж');
          if (isApproved) approved += 1;
          const source = (x.source || x.submitted_via || x.created_by || '').toString().toLowerCase();
          if (source.includes('app') || source.includes('mobile')) appCount += 1;
          if (status.includes('suspicious') || status.includes('аном')) suspicious += 1;
        }
        setMonthlyApproved(approved);
        setMonthlyAppCount(appCount);
        setMonthlySuspicious(suspicious);
      } catch {}
    };
    fetchStats();
  }, [userId, monthOffset]);

  const monthTitle = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1)
    .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }} contentContainerStyle={{ paddingVertical: 12 }}>
      <View style={styles.cardLight}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMonthOffset(v => v - 1)}><Text style={[styles.chev,{color:'#333'}]}>‹</Text></TouchableOpacity>
          <Text style={[styles.month,{color:'#333'}]}>{monthTitle}</Text>
          <TouchableOpacity onPress={() => setMonthOffset(v => v + 1)}><Text style={[styles.chev,{color:'#333'}]}>›</Text></TouchableOpacity>
        </View>

        <View style={styles.listLight}>
          <View style={styles.itemLight}>
            <Text style={[styles.itemTitle,{color:'#333'}]}>Утверждено</Text>
            <Text style={[styles.itemValue,{color:'#1d1d1f'}]}>{monthlyApproved ?? '—'}</Text>
          </View>
          <View style={styles.itemLight}>
            <Text style={[styles.itemTitle,{color:'#333'}]}>Отправлено (прил.)</Text>
            <Text style={[styles.itemValue,{color:'#1d1d1f'}]}>{monthlyAppCount ?? '—'}</Text>
          </View>
          <View style={styles.itemLight}>
            <Text style={[styles.itemTitle,{color:'#333'}]}>Сомнительные</Text>
            <Text style={[styles.itemValue,{ color:'#C62828'}]}>{monthlySuspicious ?? '—'}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardLight: { backgroundColor: '#fff', margin: 12, borderRadius: 16, paddingBottom: 10, borderWidth: 1, borderColor: '#eee' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12 },
  month: { color: '#333', fontWeight: '700', fontSize: 16, textTransform: 'capitalize' },
  chev: { color: '#333', fontSize: 28, paddingHorizontal: 6 },
  listLight: { padding: 12, gap: 10 },
  itemLight: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth:1, borderColor:'#eef2f7' },
  itemTitle: { color: '#333', fontWeight: '700' },
  itemValue: { color: '#1d1d1f', fontWeight: '800', fontSize: 16 },
});


