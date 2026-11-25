import { describe, expect, it } from 'vitest';
import {
  AttemptIdSchema,
  MAX_ANSWERED_ITEMS,
  MAX_ID_LENGTH,
  MAX_PICKS_PER_ANSWER,
  StartRequestSchema,
  SubmitAttemptRequestSchema,
} from './schema';

/** A valid submit body. Each test changes one thing to prove that one rule. */
const valid = {
  quizVersion: '2026.1',
  startedAt: '2026-11-17T00:00:00.000Z',
  answers: {
    'phish-01': ['a', 'b'],                                         // choice question
    'sim-phish-01': ['call-hotel', 'report-after-call', 'h-domain'], // simulation: actions + hotspots
  },
};

describe('SubmitAttemptRequestSchema', () => {
  it('accepts a valid body (choice and simulation answers)', () => {
    const r = SubmitAttemptRequestSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(valid);
  });

  it('accepts an empty answers object (unanswered items just score as wrong)', () => {
    expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: {} }).success).toBe(true);
  });

  it('rejects a missing startedAt', () => {
    expect(SubmitAttemptRequestSchema.safeParse({ quizVersion: '2026.1', answers: {} }).success).toBe(false);
  });

  it('rejects a startedAt that isn’t an ISO timestamp', () => {
    for (const startedAt of ['yesterday', '17/11/2026', '2026-11-17', 1700000000]) {
      expect(SubmitAttemptRequestSchema.safeParse({ ...valid, startedAt }).success, String(startedAt)).toBe(false);
    }
  });

  it('rejects an empty, too-long or odd quiz version', () => {
    for (const quizVersion of ['', 'x'.repeat(MAX_ID_LENGTH + 1), '2026 1', '../2026']) {
      expect(SubmitAttemptRequestSchema.safeParse({ ...valid, quizVersion }).success, quizVersion).toBe(false);
    }
  });

  it('rejects answers that aren’t arrays of strings', () => {
    for (const bad of [{ q1: 'a' }, { q1: [1] }, { q1: [null] }, { q1: null }, ['a']]) {
      expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('rejects ids that are too long, empty, or contain odd characters', () => {
    const badIds = ['', 'x'.repeat(MAX_ID_LENGTH + 1), '<script>', '../etc', 'has space', '_hidden', '1abc'];
    for (const id of badIds) {
      // as an option/action id...
      expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: { q1: [id] } }).success, `pick "${id}"`).toBe(false);
      // ...and as a question id (the key)
      expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: { [id]: ['a'] } }).success, `key "${id}"`).toBe(false);
    }
  });

  it('accepts an id exactly at the length limit', () => {
    const id = 'a'.repeat(MAX_ID_LENGTH);
    expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: { [id]: [id] } }).success).toBe(true);
  });

  it('caps the number of ids in one answer', () => {
    const picks = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
    expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: { q1: picks(MAX_PICKS_PER_ANSWER) } }).success).toBe(true);
    expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: { q1: picks(MAX_PICKS_PER_ANSWER + 1) } }).success).toBe(false);
  });

  it('caps the number of answered items', () => {
    const answers = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`q${i}`, ['a']]));
    expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: answers(MAX_ANSWERED_ITEMS) }).success).toBe(true);
    expect(SubmitAttemptRequestSchema.safeParse({ ...valid, answers: answers(MAX_ANSWERED_ITEMS + 1) }).success).toBe(false);
  });

  it('a "__proto__" key can’t sneak through', () => {
    const body = JSON.parse('{"quizVersion":"2026.1","startedAt":"2026-11-17T00:00:00.000Z","answers":{"__proto__":["a"]}}');
    const r = SubmitAttemptRequestSchema.safeParse(body);
    // Either rejected outright, or dropped. It must never end up in the parsed answers.
    if (r.success) expect(Object.keys(r.data.answers)).not.toContain('__proto__');
    expect(Object.getPrototypeOf(r.success ? r.data.answers : {})).toBe(Object.prototype);
  });

  it('strips extra fields, so a userId in the body can never reach our code', () => {
    const r = SubmitAttemptRequestSchema.safeParse({ ...valid, userId: 'someone-else', email: 'boss@example.com' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty('userId');
      expect(r.data).not.toHaveProperty('email');
    }
  });

  it('rejects things that aren’t objects at all', () => {
    for (const body of [null, undefined, 'hello', 42, []]) {
      expect(SubmitAttemptRequestSchema.safeParse(body).success, String(body)).toBe(false);
    }
  });
});

describe('StartRequestSchema', () => {
  it('accepts a version, rejects anything else', () => {
    expect(StartRequestSchema.safeParse({ quizVersion: '2026.1' }).success).toBe(true);
    expect(StartRequestSchema.safeParse({}).success).toBe(false);
    expect(StartRequestSchema.safeParse({ quizVersion: '' }).success).toBe(false);
  });
});

describe('AttemptIdSchema', () => {
  it('accepts normal ids (8–64 letters, digits, - or _)', () => {
    expect(AttemptIdSchema.safeParse('att-123456').success).toBe(true);
    expect(AttemptIdSchema.safeParse('3f2b9c1e-7a4d-4e8b-9f00-1a2b3c4d5e6f').success).toBe(true); // a UUID
  });
  it('rejects path tricks, scripts, and wrong lengths', () => {
    for (const id of ['../../etc/passwd', '<script>x</script>', 'short', 'x'.repeat(65), 'att 123456', '']) {
      expect(AttemptIdSchema.safeParse(id).success, id).toBe(false);
    }
  });
});
