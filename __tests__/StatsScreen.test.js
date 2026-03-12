import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

global.fetch = jest.fn();

jest.mock('../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'https://api.test.com',
    API_TOKEN: 'test-token',
    ENDPOINTS: {
      WORKSHIFTS: '/api/workshifts/',
    },
  },
}));

import StatsScreen from '../src/components/StatsScreen';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch.mockReset();
});

describe('StatsScreen', () => {
  it('renders month title', () => {
    global.fetch.mockResolvedValue({ ok: false });

    const { getByText } = render(<StatsScreen userId={42} />);

    // Current month should be displayed
    const now = new Date();
    const monthStr = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    expect(getByText(monthStr)).toBeTruthy();
  });

  it('renders stat labels', () => {
    global.fetch.mockResolvedValue({ ok: false });

    const { getByText } = render(<StatsScreen userId={42} />);

    expect(getByText('Утверждено')).toBeTruthy();
    expect(getByText('Отправлено (прил.)')).toBeTruthy();
    expect(getByText('Сомнительные')).toBeTruthy();
  });

  it('shows dashes when no data loaded', () => {
    global.fetch.mockResolvedValue({ ok: false });

    const { getAllByText } = render(<StatsScreen userId={42} />);

    const dashes = getAllByText('—');
    expect(dashes.length).toBe(3);
  });

  it('fetches and displays stats', async () => {
    const mockData = [
      { status: 'approved', source: 'app' },
      { status: 'approved', source: 'web' },
      { status: 'suspicious', source: 'mobile' },
      { status: 'normal', source: 'app' },
    ];

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { getAllByText } = render(<StatsScreen userId={42} />);

    await waitFor(() => {
      // 2 approved + 1 normal = 3, 1 suspicious
      const threes = getAllByText('3');
      expect(threes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles API response with results wrapper', async () => {
    const mockData = {
      results: [{ status: 'approved', source: 'mobile' }],
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { getAllByText } = render(<StatsScreen userId={42} />);

    await waitFor(() => {
      const ones = getAllByText('1');
      expect(ones.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates months with chevron buttons', async () => {
    global.fetch.mockResolvedValue({ ok: false });

    const { getByText } = render(<StatsScreen userId={42} />);

    // Click left chevron to go to previous month
    fireEvent.press(getByText('‹'));

    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevStr = prevMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    expect(getByText(prevStr)).toBeTruthy();

    // Click right chevron twice to go to next month
    fireEvent.press(getByText('›'));
    fireEvent.press(getByText('›'));

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextStr = nextMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    expect(getByText(nextStr)).toBeTruthy();
  });

  it('does not fetch when userId is not provided', () => {
    render(<StatsScreen userId={null} />);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles fetch error gracefully', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const { getAllByText } = render(<StatsScreen userId={42} />);

    // Should still render with dashes
    await waitFor(() => {
      const dashes = getAllByText('—');
      expect(dashes.length).toBe(3);
    });
  });
});
