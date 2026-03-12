const HTTP_MESSAGES = {
  400: 'Неверный запрос. Проверьте данные.',
  401: 'Не авторизован. Войдите в систему заново.',
  403: 'Доступ запрещен.',
  404: 'Сервис временно недоступен.',
  500: 'Ошибка сервера. Попробуйте позже.',
  502: 'Сервис временно недоступен. Попробуйте позже.',
  503: 'Сервис временно недоступен. Попробуйте позже.',
  504: 'Сервис временно недоступен. Попробуйте позже.',
};

/**
 * Нормализует ошибку axios в единый формат { success: false, error: string }.
 * @param {Error} error
 * @param {object} [options]
 * @param {boolean} [options.checkBlocked] — проверять ли блокировку (HTTP 423)
 * @returns {{ success: false, error: string }}
 */
export function normalizeApiError(error, { checkBlocked = false } = {}) {
  if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
    return { success: false, error: 'Ошибка подключения к серверу. Проверьте интернет-соединение.' };
  }

  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return { success: false, error: 'Превышено время ожидания ответа сервера. Попробуйте позже.' };
  }

  const statusCode = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (checkBlocked) {
    const isBlockedByStatus = statusCode === 423;
    const isBlockedByMessage = typeof serverMessage === 'string' && /(block|заблок)/i.test(serverMessage);
    if (isBlockedByStatus || isBlockedByMessage) {
      return { success: false, error: 'Пользователь заблокирован. Обратитесь к администратору.' };
    }
  }

  if (statusCode) {
    const message = HTTP_MESSAGES[statusCode] ?? serverMessage ?? `Ошибка сервера (${statusCode})`;
    return { success: false, error: message };
  }

  if (serverMessage) {
    return { success: false, error: serverMessage };
  }

  return { success: false, error: 'Не удалось подключиться к серверу. Проверьте интернет-соединение.' };
}
