// Утилиты для работы с сетью
export function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    fetch(url, {
      ...options,
      signal: controller.signal,
    })
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          reject(new Error(`Request timeout after ${timeoutMs}ms`));
        } else {
          reject(error);
        }
      });
  });
}
