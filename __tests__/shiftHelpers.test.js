import { canStartShift, WorkerStatus, humanizeStatus } from '../src/helpers/shift';

describe('shift helpers', () => {
  test('canStartShift returns false for BLOCKED and FIRED', () => {
    expect(canStartShift(WorkerStatus.BLOCKED)).toBe(false);
    expect(canStartShift(WorkerStatus.FIRED)).toBe(false);
  });

  test('canStartShift returns true for others', () => {
    expect(canStartShift(WorkerStatus.READY_TO_WORK)).toBe(true);
    expect(canStartShift(WorkerStatus.WORKING)).toBe(true);
    expect(canStartShift(WorkerStatus.NOT_WORKING)).toBe(true);
  });

  test('humanizeStatus maps to Russian labels', () => {
    expect(humanizeStatus(WorkerStatus.BLOCKED)).toBe('Заблокирован');
    expect(humanizeStatus(WorkerStatus.FIRED)).toBe('Уволен');
    expect(humanizeStatus(WorkerStatus.NOT_WORKING)).toBe('Не на смене');
  });
});


