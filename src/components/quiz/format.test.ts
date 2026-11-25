import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, NO_DATE } from './format';

// The same moment, shown in each CTG office's zone. In the app, the zone comes from the reader's
// device (LocalTime.tsx); here it's passed explicitly so the test doesn't depend on this PC.

const SUMMER = '2026-11-19T03:15:00.000Z'; // November: daylight saving in Adelaide/Sydney/Melbourne
const WINTER = '2026-06-19T03:15:00.000Z'; // June: no daylight saving anywhere

describe('formatDateTime in each office', () => {
  it.each([
    ['Australia/Adelaide', '19 Nov 2026, 1:45 pm ACDT', '19 June 2026, 12:45 pm ACST'],
    ['Australia/Sydney', '19 Nov 2026, 2:15 pm AEDT', '19 June 2026, 1:15 pm AEST'],
    ['Australia/Melbourne', '19 Nov 2026, 2:15 pm AEDT', '19 June 2026, 1:15 pm AEST'],
    ['Australia/Perth', '19 Nov 2026, 11:15 am AWST', '19 June 2026, 11:15 am AWST'], // no daylight saving
  ])('%s', (timeZone, summer, winter) => {
    expect(formatDateTime(SUMMER, { timeZone, showZone: true })).toBe(summer);
    expect(formatDateTime(WINTER, { timeZone, showZone: true })).toBe(winter);
  });

  it('without showZone there is no zone name', () => {
    expect(formatDateTime(SUMMER, { timeZone: 'Australia/Perth' })).toBe('19 Nov 2026, 11:15 am');
  });
});

describe('formatDate', () => {
  it('the date depends on the zone near midnight', () => {
    const lateInPerth = '2026-11-18T15:30:00.000Z'; // 11:30 pm Wed in Perth = 2:30 am Thu in Sydney
    expect(formatDate(lateInPerth, { timeZone: 'Australia/Perth' })).toBe('18 Nov 2026');
    expect(formatDate(lateInPerth, { timeZone: 'Australia/Sydney' })).toBe('19 Nov 2026');
  });
});

describe('bad input never crashes', () => {
  it.each([undefined, null, '', 'not a date'])('%s → —', (value) => {
    expect(formatDateTime(value)).toBe(NO_DATE);
    expect(formatDate(value)).toBe(NO_DATE);
  });
});
