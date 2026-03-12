import { fetchWithTimeout } from '../src/utils/net';

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('fetchWithTimeout', () => {
  it('resolves with response on success', async () => {
    const mockResponse = { ok: true, status: 200 };
    global.fetch.mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout('https://api.test.com/data');

    expect(result).toBe(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test.com/data',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('rejects with timeout error when request takes too long', async () => {
    // Mock fetch to hang until aborted
    global.fetch.mockImplementation((url, opts) => {
      return new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expect(fetchWithTimeout('https://api.test.com/slow', {}, 100))
      .rejects.toThrow('Request timeout after 100ms');
  }, 10000);

  it('uses custom timeout value', async () => {
    global.fetch.mockImplementation((url, opts) => {
      return new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expect(fetchWithTimeout('https://api.test.com/slow', {}, 50))
      .rejects.toThrow('Request timeout after 50ms');
  }, 10000);

  it('passes options to fetch', async () => {
    global.fetch.mockResolvedValue({ ok: true });

    const options = { method: 'POST', body: '{}' };
    await fetchWithTimeout('https://api.test.com', options);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test.com',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });

  it('rejects with original error on network failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(fetchWithTimeout('https://api.test.com'))
      .rejects.toThrow('Network error');
  });
});
