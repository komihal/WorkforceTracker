/**
 * dateUtils — общие утилиты для работы с датами и временными метками.
 */

/** Дополняет число нулём слева до двух символов. */
export const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

/** Unix-timestamp в секундах (целое число). */
export const unixSec = () => Math.floor(Date.now() / 1000);

/** Unix-timestamp в секундах как строка (для бекенда). */
export const unixSecStr = () => String(Math.floor(Date.now() / 1000));

/**
 * Возвращает диапазон дат для месяца со смещением от текущего.
 * @param {number} offset — 0 = текущий месяц, -1 = предыдущий и т.д.
 * @returns {{ start: string, end: string, label: string }}
 */
export const getMonthRange = (offset) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(endDate)}`;
  const label = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return { start, end, label };
};
