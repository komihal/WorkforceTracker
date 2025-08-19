export const WorkerStatus = {
  READY_TO_WORK: 'READY_TO_WORK',
  WORKING: 'WORKING',
  MISSING_3_DAYS: 'MISSING_3_DAYS',
  NOT_WORKING: 'NOT_WORKING',
  FIRED: 'FIRED',
  BLOCKED: 'BLOCKED',
};

export const canStartShift = (status) => {
  return !(status === WorkerStatus.BLOCKED || status === WorkerStatus.FIRED);
};

export const humanizeStatus = (status) => {
  const map = {
    [WorkerStatus.READY_TO_WORK]: 'Готов к работе',
    [WorkerStatus.WORKING]: 'Активен',
    [WorkerStatus.MISSING_3_DAYS]: 'Пропуск > 3х подряд',
    [WorkerStatus.NOT_WORKING]: 'Не на смене',
    [WorkerStatus.FIRED]: 'Уволен',
    [WorkerStatus.BLOCKED]: 'Заблокирован',
  };
  return map[status] || String(status || '');
};

// Normalize various API-provided values (strings/codes) into our WorkerStatus
export const normalizeStatus = (raw, isWorking) => {
  console.log('normalizeStatus input:', { raw, isWorking, rawType: typeof raw });
  
  if (typeof raw === 'string') {
    // Проверяем на пустую строку или строку только с пробелами
    if (raw.trim() === '' || raw.trim().length === 0) {
      console.log('Empty string or whitespace-only string detected, using isWorking fallback');
      if (isWorking === true) return WorkerStatus.WORKING;
      if (isWorking === false) return WorkerStatus.READY_TO_WORK;
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Проверяем, не является ли строка JSON
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        console.log('Parsed JSON string:', parsed);
        return normalizeStatus(parsed, isWorking);
      }
    } catch (e) {
      // Не JSON, продолжаем как обычную строку
    }
    
    const normalized = raw.trim().toLowerCase();
    console.log('Normalized string:', normalized);
    
    // Убираем HTML теги если они есть
    const cleanNormalized = normalized.replace(/<[^>]*>/g, '').trim();
    if (cleanNormalized !== normalized) {
      console.log('Cleaned HTML tags, new normalized:', cleanNormalized);
    }
    
    // Приоритетные статусы, которые не должны переопределяться
    if (cleanNormalized.includes('fire') || cleanNormalized.includes('уволен') || cleanNormalized.includes('dismissed')) {
      console.log('Detected FIRED status');
      return WorkerStatus.FIRED;
    }
    if (cleanNormalized.includes('block') || cleanNormalized.includes('заблок') || cleanNormalized.includes('блок') || 
        cleanNormalized.includes('lock') || cleanNormalized.includes('закрыт') || cleanNormalized.includes('отключен') ||
        cleanNormalized.includes('denied') || cleanNormalized.includes('disabled') || cleanNormalized.includes('suspended')) {
      console.log('Detected BLOCKED status');
      return WorkerStatus.BLOCKED;
    }
    
    // Остальные статусы
    if (cleanNormalized.includes('work') || cleanNormalized.includes('актив') || cleanNormalized.includes('active') || 
        cleanNormalized.includes('on') || cleanNormalized.includes('включен')) {
      console.log('Detected WORKING status');
      return WorkerStatus.WORKING;
    }
    if (cleanNormalized.includes('missing') || cleanNormalized.includes('пропуск') || cleanNormalized.includes('absent')) {
      console.log('Detected MISSING_3_DAYS status');
      return WorkerStatus.MISSING_3_DAYS;
    }
    if (cleanNormalized.includes('not') || cleanNormalized.includes('не') || cleanNormalized.includes('off') || 
        cleanNormalized.includes('inactive') || cleanNormalized.includes('неактив')) {
      console.log('Detected NOT_WORKING status');
      return WorkerStatus.NOT_WORKING;
    }
    
    // Проверяем статусы "готов к работе"
    if (cleanNormalized.includes('ready') || cleanNormalized.includes('готов') || cleanNormalized.includes('available') || 
        cleanNormalized.includes('доступен') || cleanNormalized.includes('free') || cleanNormalized.includes('свободен')) {
      console.log('Detected READY_TO_WORK status');
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Проверяем числовые значения в строке
    if (cleanNormalized === '0' || cleanNormalized === '1' || cleanNormalized === '2' || cleanNormalized === '3') {
      console.log('Detected numeric status:', cleanNormalized);
      // Маппинг числовых статусов
      if (cleanNormalized === '0') return WorkerStatus.READY_TO_WORK;
      if (cleanNormalized === '1') return WorkerStatus.WORKING;
      if (cleanNormalized === '2') return WorkerStatus.BLOCKED;
      if (cleanNormalized === '3') return WorkerStatus.FIRED;
    }
    
    // Проверяем специальные символы или коды
    if (cleanNormalized === 'x' || cleanNormalized === 'х' || cleanNormalized === '❌' || cleanNormalized === '✗') {
      console.log('Detected BLOCKED status from symbol');
      return WorkerStatus.BLOCKED;
    }
    if (cleanNormalized === '✓' || cleanNormalized === '✔' || cleanNormalized === '✅') {
      console.log('Detected READY_TO_WORK status from symbol');
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Проверяем строки только со специальными символами
    if (/^[^\wа-яё\s]*$/.test(cleanNormalized)) {
      console.log('String contains only special characters, using isWorking fallback');
      if (isWorking === true) return WorkerStatus.WORKING;
      if (isWorking === false) return WorkerStatus.READY_TO_WORK;
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Проверяем строки только с цифрами
    if (/^\d+$/.test(cleanNormalized)) {
      console.log('String contains only digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized, 10);
      if (numValue === 0) return WorkerStatus.READY_TO_WORK;
      if (numValue === 1) return WorkerStatus.WORKING;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки только с буквами
    if (/^[a-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с буквами и пробелами
    if (/^[a-zA-Zа-яё\s]+$/.test(cleanNormalized)) {
      console.log('String contains only letters and spaces:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с цифрами и пробелами
    if (/^[\d\s]+$/.test(cleanNormalized)) {
      console.log('String contains only digits and spaces:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.READY_TO_WORK;
      if (numValue === 1) return WorkerStatus.WORKING;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters, using isWorking fallback');
      if (isWorking === true) return WorkerStatus.WORKING;
      if (isWorking === false) return WorkerStatus.READY_TO_WORK;
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags, using isWorking fallback');
      if (isWorking === true) return WorkerStatus.WORKING;
      if (isWorking === false) return WorkerStatus.READY_TO_WORK;
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.READY_TO_WORK;
      if (numValue === 1) return WorkerStatus.WORKING;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.READY_TO_WORK;
      if (numValue === 1) return WorkerStatus.WORKING;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.READY_TO_WORK;
      if (numValue === 1) return WorkerStatus.WORKING;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String.contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яё]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яА-Я]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и специальными символами
    if (/^[\s\W]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and special characters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и цифрами
    if (/^[\s\d]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and digits:', cleanNormalized);
      const numValue = parseInt(cleanNormalized.replace(/\s/g, ''), 10);
      if (numValue === 0) return WorkerStatus.WORKING;
      if (numValue === 1) return WorkerStatus.READY_TO_WORK;
      if (numValue === 2) return WorkerStatus.BLOCKED;
      if (numValue === 3) return WorkerStatus.FIRED;
    }
    
    // Проверяем строки с пробелами и HTML тегами
    if (/^[\s<>\/]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and HTML tags:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
    
    // Проверяем строки с пробелами и буквами
    if (/^[\sa-zA-Zа-яА-Я]+$/.test(cleanNormalized)) {
      console.log('String contains only spaces and letters:', cleanNormalized);
      // Здесь уже обработаны все возможные варианты выше
    }
  }
  
  // Проверяем числовые значения
  if (typeof raw === 'number') {
    console.log('Raw is number:', raw);
    
    // Проверяем на NaN
    if (isNaN(raw)) {
      console.log('NaN detected, using isWorking fallback');
      if (isWorking === true) return WorkerStatus.WORKING;
      if (isWorking === false) return WorkerStatus.READY_TO_WORK;
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Проверяем на бесконечность
    if (!isFinite(raw)) {
      console.log('Infinity detected, using isWorking fallback');
      if (isWorking === true) return WorkerStatus.WORKING;
      if (isWorking === false) return WorkerStatus.READY_TO_WORK;
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Добавляем маппинг числовых статусов
    if (raw === 0) return WorkerStatus.READY_TO_WORK;
    if (raw === 1) return WorkerStatus.WORKING;
    if (raw === 2) return WorkerStatus.BLOCKED;
    if (raw === 3) return WorkerStatus.FIRED;
  }
  
  // Проверяем булевые значения
  if (typeof raw === 'boolean') {
    console.log('Raw is boolean:', raw);
    if (raw === false) return WorkerStatus.BLOCKED;
    if (raw === true) return WorkerStatus.READY_TO_WORK;
  }
  
  // Проверяем объекты
  if (typeof raw === 'object' && raw !== null) {
    console.log('Raw is object:', raw);
    
    // Проверяем на пустой объект
    if (Object.keys(raw).length === 0) {
      console.log('Empty object detected, using isWorking fallback');
      if (isWorking === true) return WorkerStatus.WORKING;
      if (isWorking === false) return WorkerStatus.READY_TO_WORK;
      return WorkerStatus.READY_TO_WORK;
    }
    
    // Если это объект с полем status
    if (raw.status !== undefined) {
      return normalizeStatus(raw.status, isWorking);
    }
    // Если это объект с полем blocked
    if (raw.blocked === true || raw.is_blocked === true) {
      return WorkerStatus.BLOCKED;
    }
    // Если это объект с полем working
    if (raw.working === true || raw.is_working === true) {
      return WorkerStatus.WORKING;
    }
    
    // Проверяем другие возможные поля
    if (raw.access_denied === true || raw.disabled === true || raw.suspended === true) {
      return WorkerStatus.BLOCKED;
    }
    if (raw.active === true || raw.enabled === true) {
      return WorkerStatus.READY_TO_WORK;
    }
  }
  
  // Проверяем массивы
  if (Array.isArray(raw)) {
    console.log('Raw is array:', raw);
    // Если массив пустой
    if (raw.length === 0) {
      console.log('Empty array detected, using isWorking fallback');
      if (isWorking === true) return WorkerStatus.WORKING;
      if (isWorking === false) return WorkerStatus.READY_TO_WORK;
      return WorkerStatus.READY_TO_WORK;
    }
    // Если массив содержит статус, берем первый элемент
    if (raw.length > 0) {
      return normalizeStatus(raw[0], isWorking);
    }
  }
  
  // Проверяем функции
  if (typeof raw === 'function') {
    console.log('Raw is function, calling it with isWorking');
    try {
      const result = raw(isWorking);
      return normalizeStatus(result, isWorking);
    } catch (e) {
      console.log('Error calling function:', e);
    }
  }
  
  // Проверяем символы
  if (typeof raw === 'symbol') {
    console.log('Raw is symbol:', raw.toString());
    const symbolStr = raw.toString();
    if (symbolStr.includes('block') || symbolStr.includes('deny') || symbolStr.includes('disable')) {
      return WorkerStatus.BLOCKED;
    }
    if (symbolStr.includes('work') || symbolStr.includes('active') || symbolStr.includes('enable')) {
      return WorkerStatus.WORKING;
    }
  }
  
  // Проверяем BigInt
  if (typeof raw === 'bigint') {
    console.log('Raw is BigInt:', raw.toString());
    const bigIntValue = Number(raw);
    if (bigIntValue === 0) return WorkerStatus.READY_TO_WORK;
    if (bigIntValue === 1) return WorkerStatus.WORKING;
    if (bigIntValue === 2) return WorkerStatus.BLOCKED;
    if (bigIntValue === 3) return WorkerStatus.FIRED;
  }
  
  // isWorking флаг используется только если raw статус не определен или не является критическим
  if (isWorking === true) {
    console.log('Using isWorking=true -> WORKING');
    return WorkerStatus.WORKING;
  }
  if (isWorking === false) {
    console.log('Using isWorking=false -> READY_TO_WORK');
    return WorkerStatus.READY_TO_WORK;
  }
  
  // Если raw статус null/undefined, но есть isWorking флаг
  if (raw === null || raw === undefined) {
    console.log('Raw status is null/undefined, using isWorking fallback');
    if (isWorking === true) return WorkerStatus.WORKING;
    if (isWorking === false) return WorkerStatus.READY_TO_WORK;
  }
  
  // Дополнительная проверка для неизвестных типов
  console.log('Unknown type or value, using default fallback');
  console.log('Raw value:', raw);
  console.log('Raw type:', typeof raw);
  console.log('isWorking value:', isWorking);
  
  console.log('Default fallback -> READY_TO_WORK');
  return WorkerStatus.READY_TO_WORK;
};


