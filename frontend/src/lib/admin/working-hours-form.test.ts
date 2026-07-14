import { describe, expect, it } from 'vitest';
import { compactHours, expandHours } from './working-hours-form';

describe('working hours form model', () => {
  it('expands per-day keys', () => {
    const days = expandHours({ mon: { open: '09:00', close: '20:00' }, sun: null });
    expect(days.mon).toEqual({ open: '09:00', close: '20:00' });
    expect(days.sun).toBeNull();
    expect(days.tue).toBeNull();
  });

  it('expands ranged keys into covered days', () => {
    const days = expandHours({
      mon_fri: { open: '09:00', close: '20:00' },
      weekend: { open: '10:00', close: '18:00' },
    });
    expect(days.wed).toEqual({ open: '09:00', close: '20:00' });
    expect(days.sat).toEqual({ open: '10:00', close: '18:00' });
    expect(days.sun).toEqual({ open: '10:00', close: '18:00' });
  });

  it('treats malformed slots as closed', () => {
    const days = expandHours({ mon: { open: '', close: '20:00' } });
    expect(days.mon).toBeNull();
  });

  it('compacts an all-closed schedule to null', () => {
    expect(compactHours(expandHours(null))).toBeNull();
    const some = expandHours({ mon: { open: '09:00', close: '20:00' } });
    expect(compactHours(some)).toMatchObject({ mon: { open: '09:00', close: '20:00' } });
  });
});
