/**
 * useMonthlyStats — хук для загрузки и хранения месячной статистики смен.
 *
 * Использование:
 *   const { monthlyStats, monthOffset, setMonthOffset, loadMonthlyStats } = useMonthlyStats(userId);
 */
import { useState, useCallback } from 'react';
import { API_CONFIG } from '../config/api';
import httpClient from '../api/httpClient';

export function useMonthlyStats(userId) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState({
    recorded: null,
    approved: null,
    approvedHours: null,
    appCount: null,
    suspicious: null,
  });

  const loadMonthlyStats = useCallback(async (offset = 0) => {
    if (!userId) return;

    try {
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const response = await httpClient.get(API_CONFIG.ENDPOINTS.WORKSHIFTS, {
        params: {
          api_token: API_CONFIG.API_TOKEN,
          user_id: userId,
          year,
          month,
        },
      });

      const data = response.data;
      setMonthlyStats({
        recorded: data?.total_shifts ?? null,
        approved: data?.approved_shifts ?? null,
        approvedHours: data?.approved_hours ?? null,
        appCount: data?.app_shifts ?? null,
        suspicious: data?.suspicious_shifts ?? null,
      });
    } catch {}
  }, [userId]);

  return {
    monthlyStats,
    monthOffset,
    setMonthOffset,
    loadMonthlyStats,
  };
}
