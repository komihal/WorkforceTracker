import {
  WorkerStatus,
  canStartShift,
  humanizeStatus,
  normalizeStatus,
} from '../src/helpers/shift';

describe('WorkerStatus constants', () => {
  it('has all expected statuses', () => {
    expect(WorkerStatus.READY_TO_WORK).toBe('READY_TO_WORK');
    expect(WorkerStatus.WORKING).toBe('WORKING');
    expect(WorkerStatus.MISSING_3_DAYS).toBe('MISSING_3_DAYS');
    expect(WorkerStatus.NOT_WORKING).toBe('NOT_WORKING');
    expect(WorkerStatus.FIRED).toBe('FIRED');
    expect(WorkerStatus.BLOCKED).toBe('BLOCKED');
  });
});

describe('canStartShift', () => {
  it('returns true for READY_TO_WORK', () => {
    expect(canStartShift(WorkerStatus.READY_TO_WORK)).toBe(true);
  });

  it('returns true for WORKING', () => {
    expect(canStartShift(WorkerStatus.WORKING)).toBe(true);
  });

  it('returns true for MISSING_3_DAYS', () => {
    expect(canStartShift(WorkerStatus.MISSING_3_DAYS)).toBe(true);
  });

  it('returns true for NOT_WORKING', () => {
    expect(canStartShift(WorkerStatus.NOT_WORKING)).toBe(true);
  });

  it('returns false for BLOCKED', () => {
    expect(canStartShift(WorkerStatus.BLOCKED)).toBe(false);
  });

  it('returns false for FIRED', () => {
    expect(canStartShift(WorkerStatus.FIRED)).toBe(false);
  });

  it('returns true for undefined/null', () => {
    expect(canStartShift(undefined)).toBe(true);
    expect(canStartShift(null)).toBe(true);
  });
});

describe('humanizeStatus', () => {
  it.each([
    ['READY_TO_WORK', 'Готов к работе'],
    ['WORKING', 'Активен'],
    ['MISSING_3_DAYS', 'Пропуск > 3х подряд'],
    ['NOT_WORKING', 'Не на смене'],
    ['FIRED', 'Уволен'],
    ['BLOCKED', 'Заблокирован'],
  ])('returns correct label for %s', (status, expected) => {
    expect(humanizeStatus(status)).toBe(expected);
  });

  it('returns string representation for unknown status', () => {
    expect(humanizeStatus('CUSTOM')).toBe('CUSTOM');
  });

  it('handles null/undefined', () => {
    expect(humanizeStatus(null)).toBe('');
    expect(humanizeStatus(undefined)).toBe('');
  });
});

describe('normalizeStatus', () => {
  describe('string statuses (English)', () => {
    it('detects FIRED from "fired"', () => {
      expect(normalizeStatus('fired')).toBe(WorkerStatus.FIRED);
    });

    it('detects FIRED from "dismissed"', () => {
      expect(normalizeStatus('dismissed')).toBe(WorkerStatus.FIRED);
    });

    it('detects BLOCKED from "blocked"', () => {
      expect(normalizeStatus('blocked')).toBe(WorkerStatus.BLOCKED);
    });

    it('detects BLOCKED from "disabled"', () => {
      expect(normalizeStatus('disabled')).toBe(WorkerStatus.BLOCKED);
    });

    it('detects BLOCKED from "suspended"', () => {
      expect(normalizeStatus('suspended')).toBe(WorkerStatus.BLOCKED);
    });

    it('detects WORKING from "active"', () => {
      expect(normalizeStatus('active')).toBe(WorkerStatus.WORKING);
    });

    it('detects WORKING from "working"', () => {
      expect(normalizeStatus('working')).toBe(WorkerStatus.WORKING);
    });

    it('detects MISSING_3_DAYS from "missing"', () => {
      expect(normalizeStatus('missing')).toBe(WorkerStatus.MISSING_3_DAYS);
    });

    it('detects MISSING_3_DAYS from "absent"', () => {
      expect(normalizeStatus('absent')).toBe(WorkerStatus.MISSING_3_DAYS);
    });

    it('detects NOT_WORKING from "off"', () => {
      expect(normalizeStatus('off')).toBe(WorkerStatus.NOT_WORKING);
    });

    it('detects READY_TO_WORK from "ready"', () => {
      expect(normalizeStatus('ready')).toBe(WorkerStatus.READY_TO_WORK);
    });

    it('detects READY_TO_WORK from "available"', () => {
      expect(normalizeStatus('available')).toBe(WorkerStatus.READY_TO_WORK);
    });
  });

  describe('string statuses (Russian)', () => {
    it('detects FIRED from "уволен"', () => {
      expect(normalizeStatus('уволен')).toBe(WorkerStatus.FIRED);
    });

    it('detects BLOCKED from "заблокирован"', () => {
      expect(normalizeStatus('заблокирован')).toBe(WorkerStatus.BLOCKED);
    });

    it('detects WORKING from "активен"', () => {
      expect(normalizeStatus('активен')).toBe(WorkerStatus.WORKING);
    });

    it('detects MISSING_3_DAYS from "пропуск"', () => {
      expect(normalizeStatus('пропуск')).toBe(WorkerStatus.MISSING_3_DAYS);
    });

    it('detects READY_TO_WORK from "готов"', () => {
      expect(normalizeStatus('готов')).toBe(WorkerStatus.READY_TO_WORK);
    });
  });

  describe('numeric statuses', () => {
    it('maps 0 to READY_TO_WORK', () => {
      expect(normalizeStatus('0')).toBe(WorkerStatus.READY_TO_WORK);
    });

    it('maps 1 to WORKING', () => {
      expect(normalizeStatus('1')).toBe(WorkerStatus.WORKING);
    });

    it('maps 2 to BLOCKED', () => {
      expect(normalizeStatus('2')).toBe(WorkerStatus.BLOCKED);
    });

    it('maps 3 to FIRED', () => {
      expect(normalizeStatus('3')).toBe(WorkerStatus.FIRED);
    });

    it('maps number 0 to READY_TO_WORK', () => {
      expect(normalizeStatus(0)).toBe(WorkerStatus.READY_TO_WORK);
    });

    it('maps number 1 to WORKING', () => {
      expect(normalizeStatus(1)).toBe(WorkerStatus.WORKING);
    });
  });

  describe('edge cases', () => {
    it('handles empty string with isWorking=true', () => {
      expect(normalizeStatus('', true)).toBe(WorkerStatus.WORKING);
    });

    it('handles empty string with isWorking=false', () => {
      expect(normalizeStatus('', false)).toBe(WorkerStatus.READY_TO_WORK);
    });

    it('handles whitespace-only string', () => {
      expect(normalizeStatus('   ')).toBe(WorkerStatus.READY_TO_WORK);
    });

    it('handles case insensitivity', () => {
      expect(normalizeStatus('BLOCKED')).toBe(WorkerStatus.BLOCKED);
      expect(normalizeStatus('Fired')).toBe(WorkerStatus.FIRED);
    });

    it('handles HTML tags in status', () => {
      expect(normalizeStatus('<b>blocked</b>')).toBe(WorkerStatus.BLOCKED);
    });

    it('handles JSON string input', () => {
      const jsonStr = JSON.stringify('blocked');
      const result = normalizeStatus(jsonStr);
      expect(result).toBe(WorkerStatus.BLOCKED);
    });

    it('handles special symbols', () => {
      expect(normalizeStatus('✓')).toBe(WorkerStatus.READY_TO_WORK);
      expect(normalizeStatus('❌')).toBe(WorkerStatus.BLOCKED);
      expect(normalizeStatus('x')).toBe(WorkerStatus.BLOCKED);
    });
  });

  describe('isWorking fallback', () => {
    it('uses isWorking when status is null', () => {
      expect(normalizeStatus(null, true)).toBe(WorkerStatus.WORKING);
      expect(normalizeStatus(null, false)).toBe(WorkerStatus.READY_TO_WORK);
    });

    it('uses isWorking when status is undefined', () => {
      expect(normalizeStatus(undefined, true)).toBe(WorkerStatus.WORKING);
      expect(normalizeStatus(undefined, false)).toBe(WorkerStatus.READY_TO_WORK);
    });
  });
});
