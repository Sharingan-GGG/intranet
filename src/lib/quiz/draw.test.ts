import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({})); // the real question bank is server-only

import { drawItemIds, drawKey, itemsPerAttempt, seededRandom, shuffle, toPublicDraw } from './draw';
import { quiz2026_1 } from './questions.2026.1';
import type { Quiz } from './types';

/*
 * The random selection per attempt (draw.ts), tested against the REAL 2026.1 bank.
 * What matters: same key → same selection (refresh can't re-roll, the server can re-derive it at
 * submit); different people / attempts → different selections; right counts; topics spread;
 * no answer key in what the browser gets.
 */

const quiz = quiz2026_1;
const rule = quiz.draw!;
const sims = new Set((quiz.simulations ?? []).map((s) => s.id));
const topicOf = new Map(quiz.questions.map((q) => [q.id, q.topic]));
const key = (user: string, attempt = 1) => drawKey(user, quiz.version, attempt);

describe('seeded randomness', () => {
  it('same seed → same sequence; different seed → different sequence', () => {
    const a = seededRandom('x');
    const b = seededRandom('x');
    const c = seededRandom('y');
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
    for (const n of seqA) expect(n >= 0 && n < 1).toBe(true);
  });

  it('shuffle returns a permutation and never changes its input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seededRandom('s'));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('drawItemIds on the real bank', () => {
  it('gives the configured counts, with no duplicates', () => {
    const ids = drawItemIds(quiz, key('u1'));
    expect(ids).toHaveLength(rule.questions + rule.simulations);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => sims.has(id))).toHaveLength(rule.simulations);
    expect(itemsPerAttempt(quiz)).toBe(ids.length);
  });

  it('is deterministic: the same person and attempt always get the same selection and order', () => {
    expect(drawItemIds(quiz, key('u1'))).toEqual(drawItemIds(quiz, key('u1')));
  });

  it('differs between people, and between one person’s attempts', () => {
    const base = drawItemIds(quiz, key('u1'));
    expect(drawItemIds(quiz, key('u2'))).not.toEqual(base);
    expect(drawItemIds(quiz, key('u1', 2))).not.toEqual(base);
  });

  it('every draw covers every topic in the bank (choice questions are spread round-robin)', () => {
    const topics = new Set(topicOf.values());
    for (let u = 0; u < 50; u++) {
      const drawn = new Set(drawItemIds(quiz, key(`user-${u}`)).flatMap((id) => topicOf.get(id) ?? []));
      expect(drawn, `user-${u} missed a topic`).toEqual(topics);
    }
  });

  it('over many people, every item in the bank gets used (nothing is stuck out of rotation)', () => {
    const seen = new Set<string>();
    for (let u = 0; u < 200; u++) for (const id of drawItemIds(quiz, key(`user-${u}`))) seen.add(id);
    expect(seen.size).toBe(quiz.questions.length + sims.size);
  });

  it('two colleagues rarely get the same set, and never the same order', () => {
    // Pairwise overlap across 30 people: on average well under the full 15.
    const draws = Array.from({ length: 30 }, (_, u) => drawItemIds(quiz, key(`user-${u}`)));
    let overlap = 0;
    let pairs = 0;
    for (let i = 0; i < draws.length; i++)
      for (let j = i + 1; j < draws.length; j++) {
        overlap += draws[i].filter((id) => draws[j].includes(id)).length;
        pairs++;
        expect(draws[i]).not.toEqual(draws[j]);
      }
    expect(overlap / pairs).toBeLessThan(10);
  });

  it('without a draw rule: every item, in the order written (questions, then scenarios)', () => {
    const all: Quiz = { ...quiz, draw: undefined };
    expect(drawItemIds(all, key('u1'))).toEqual([...quiz.questions.map((q) => q.id), ...sims]);
  });

  it('caps counts larger than the bank', () => {
    const greedy: Quiz = { ...quiz, draw: { questions: 999, simulations: 999 } };
    expect(drawItemIds(greedy, key('u1'))).toHaveLength(quiz.questions.length + sims.size);
  });
});

describe('toPublicDraw: what the browser gets', () => {
  const pub = toPublicDraw(quiz, key('u1'));

  it('contains exactly the drawn items, with `order` set', () => {
    const ids = drawItemIds(quiz, key('u1'));
    expect(pub.order).toEqual(ids);
    expect([...pub.questions.map((q) => q.id), ...(pub.simulations ?? []).map((s) => s.id)].sort()).toEqual([...ids].sort());
  });

  it('leaks no answer keys', () => {
    const json = JSON.stringify(pub);
    for (const secret of ['"correct"', 'explanation', 'policyRef', 'actionResults', 'hotspotResults', 'feedback', 'minFlags', 'maxFalseFlags']) {
      expect(json, `public draw contains ${secret}`).not.toContain(secret);
    }
  });

  it('only REORDERS options and actions (same ids), and keeps True / False in order', () => {
    for (const q of pub.questions) {
      const original = quiz.questions.find((x) => x.id === q.id)!;
      expect(q.options.map((o) => o.id).sort()).toEqual(original.options.map((o) => o.id).sort());
      if (q.type === 'truefalse') expect(q.options.map((o) => o.id)).toEqual(['true', 'false']);
    }
    for (const s of pub.simulations ?? []) {
      const original = quiz.simulations!.find((x) => x.id === s.id)!;
      s.steps.forEach((step, i) =>
        expect(step.actions.map((a) => a.id).sort()).toEqual(original.steps[i].actions.map((a) => a.id).sort()),
      );
    }
  });

  it('is the same on every call (a refresh shows the same screen)', () => {
    expect(toPublicDraw(quiz, key('u1'))).toEqual(pub);
  });
});
