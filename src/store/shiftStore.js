import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'shiftStore@v1';
const TTL_MS = 10 * 60 * 1000; // 10 минут

let state = {
  isActive: false,
  shiftId: null,
  shiftStart: null,
  sourceOfTruth: 'local', // 'server' | 'local'
  updatedAt: 0,
};

const listeners = new Set();

function emit() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

export function getState() {
  return state;
}

function set(next) {
  state = { ...state, ...next, updatedAt: Date.now() };
  emit();
  persist().catch(() => {});
}

export function setFromServer(snapshot) {
  const has = !!(snapshot?.has_active_shift);
  const sid = snapshot?.active_shift?.id ?? snapshot?.active_shift?.shift_id ?? null;
  const st = snapshot?.active_shift?.shift_start ?? null;
  set({ isActive: has, shiftId: sid, shiftStart: st, sourceOfTruth: 'server' });
}

export function setFromLocal(partial) {
  set({ ...partial, sourceOfTruth: 'local' });
}

export async function persist() {
  try {
    const payload = { ...state, _ts: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
}

export async function hydrateFromCache() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data?._ts) return;
    const age = Date.now() - data._ts;
    if (age <= TTL_MS) {
      state = { ...state, ...data };
      emit();
    }
  } catch {}
}

export function useShiftStore(selector = (s) => s) {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => selector(state),
    () => selector(state),
  );
}

export async function initShiftStore() {
  await hydrateFromCache();
}



