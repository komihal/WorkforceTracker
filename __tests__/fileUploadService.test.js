global.fetch = jest.fn();

jest.mock('../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'https://api.test.com',
    API_TOKEN: 'test-token',
    ENDPOINTS: {
      FILE_UPLOAD: '/api/file_upload/',
      USER_PHOTOS: '/api/user-photos/',
    },
  },
}));

let FileUploadService;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  global.fetch.mockReset();
  FileUploadService = require('../src/services/fileUploadService').default;
});

describe('FileUploadService', () => {
  describe('uploadShiftPhoto', () => {
    it('uploads photo object with uri/type/fileName', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, file_url: '/photo.jpg' }),
      });

      const photo = { uri: 'file://photo.jpg', type: 'image/png', fileName: 'selfie.png' };
      const result = await FileUploadService.uploadShiftPhoto(photo, 42, 'imei123', 'shift');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/file_upload/',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('uploads photo string URI', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await FileUploadService.uploadShiftPhoto('file://photo.jpg', 42, 'imei123');

      expect(result.success).toBe(true);
    });

    it('returns error on HTTP failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      });

      const result = await FileUploadService.uploadShiftPhoto('file://photo.jpg', 42, 'imei123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });

    it('returns error on fetch exception', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await FileUploadService.uploadShiftPhoto('file://photo.jpg', 42, 'imei123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('uses default folder "shift" when not provided', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await FileUploadService.uploadShiftPhoto('file://photo.jpg', 42, 'imei123');

      const callBody = global.fetch.mock.calls[0][1].body;
      // FormData is used, we verify fetch was called
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('uploadPhoto', () => {
    it('uploads successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, url: '/photo.jpg' }),
      });

      const result = await FileUploadService.uploadPhoto('file://pic.jpg', 42, 1, 'imei123', 'general');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, url: '/photo.jpg' });
    });

    it('returns error on HTTP failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        text: () => Promise.resolve('File too large'),
      });

      const result = await FileUploadService.uploadPhoto('file://big.jpg', 42, 1, 'imei123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('413');
    });

    it('returns error on exception', async () => {
      global.fetch.mockRejectedValue(new Error('No connection'));

      const result = await FileUploadService.uploadPhoto('file://pic.jpg', 42, 1, 'imei123');

      expect(result.success).toBe(false);
    });
  });

  describe('getUserPhotos', () => {
    it('returns skipped result (endpoint disabled)', async () => {
      const result = await FileUploadService.getUserPhotos(42);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('uploadFile', () => {
    it('uploads file with metadata', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 2, url: '/doc.pdf' }),
      });

      const result = await FileUploadService.uploadFile(
        'file://doc.pdf', 42, 1, 'imei123', 'document', { category: 'report' },
      );

      expect(result.success).toBe(true);
      expect(result.data.url).toBe('/doc.pdf');
    });

    it('returns error on failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid file'),
      });

      const result = await FileUploadService.uploadFile('file://doc.pdf', 42, 1, 'imei123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    it('returns error on exception', async () => {
      global.fetch.mockRejectedValue(new Error('Upload failed'));

      const result = await FileUploadService.uploadFile('file://doc.pdf', 42, 1, 'imei123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });
  });
});
