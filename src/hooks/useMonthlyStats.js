/**
 * useMonthlyStats — хук для загрузки и вычисления месячной статистики смен.
 *
 * Использование:
 *   const { monthlyStats, monthOffset, setMonthOffset } = useMonthlyStats(userId);
 */
import { useState, useEffect } from 'react';
import { getMonthRange } from '../utils/dateUtils';

export function useMonthlyStats(userId) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState({
    recorded: null,
    approved: null,
    approvedHours: null,
    appCount: null,
    suspicious: null,
  });

  useEffect(() => {
    const fetchMonthlyStats = async () => {
      try {
        if (!userId) return;
        const { API_CONFIG } = require('../config/api');

        const shiftsRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHIFTS}?user_id=${userId}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_CONFIG.API_TOKEN}` },
        });

        let list = [];
        if (shiftsRes.ok) {
          const shiftsData = await shiftsRes.json();
          if (shiftsData.success && Array.isArray(shiftsData.shifts)) {
            list = shiftsData.shifts;
          } else if (Array.isArray(shiftsData)) {
            list = shiftsData;
          } else if (Array.isArray(shiftsData?.results)) {
            list = shiftsData.results;
          }
        }

        const { start, end } = getMonthRange(monthOffset);
        const monthlyList = list.filter(shift => {
          const shiftDate = shift.shift_start || shift.date;
          if (!shiftDate) return false;
          const date = new Date(shiftDate);
          return date >= new Date(start) && date <= new Date(end);
        });

        let approved = 0;
        let approvedHours = 0;
        let appCount = 0;
        let suspicious = 0;
        const toHrs = (ms) => ms / (1000 * 60 * 60);

        for (const x of monthlyList) {
          const status = (x.shift_status || x.status || '').toString().toLowerCase();
          const isApproved = status.includes('approved') || status.includes('normal') || status.includes('утверж');
          if (isApproved) approved += 1;

          let hrs = x.shift_duration || x.shift_duration_hours || x.duration_hours || null;
          if (hrs == null && x.shift_start && x.shift_end) {
            const st = new Date(x.shift_start).getTime();
            const en = new Date(x.shift_end).getTime();
            if (!isNaN(st) && !isNaN(en) && en > st) hrs = toHrs(en - st);
          }
          if (isApproved && typeof hrs === 'number') approvedHours += hrs;

          const source = (x.source || x.submitted_via || x.created_by || '').toString().toLowerCase();
          if (source.includes('app') || source.includes('mobile')) appCount += 1;
          if (status.includes('suspicious') || status.includes('аном') || (typeof hrs === 'number' && hrs < 0.25)) suspicious += 1;
        }

        setMonthlyStats({
          recorded: monthlyList.length,
          approved,
          approvedHours: approvedHours ? Number(approvedHours.toFixed(1)) : 0,
          appCount,
          suspicious,
        });
      } catch {}
    };

    fetchMonthlyStats();
  }, [userId, monthOffset]);

  return { monthlyStats, monthOffset, setMonthOffset };
}
