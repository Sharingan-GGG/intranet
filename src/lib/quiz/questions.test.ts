import { describe, expect, it, vi } from 'vitest';

// The question bank starts with `import 'server-only'`, which throws outside a Next.js server.
// Replace it with an empty module for this test only. (vi.mock is hoisted above the imports below.)
vi.mock('server-only', () => ({}));

import { quiz2026_1 } from './questions.2026.1';
import { toPublicQuiz } from './scoring';
import { IdSchema, MAX_ANSWERED_ITEMS, MAX_PICKS_PER_ANSWER } from './schema';
import type { PrivateSimulationQuestion, SimulationStep } from './simulation.types';

/*
 * Checks the REAL question bank for authoring mistakes. Run this after editing questions.
 * The scoring rules themselves are tested with small fixtures in scoring.test.ts and
 * simulation-scoring.test.ts. This file only checks the data is well-formed.
 */

const quiz = quiz2026_1;
const sims = quiz.simulations ?? [];

/** Most actions a player can take in one run of a simulation (the deepest route through the steps). */
function longestRoute(sim: PrivateSimulationQuestion): number {
  const steps = new Map(sim.steps.map((s) => [s.id, s]));
  const depth = (stepId: string, seen: Set<string>): number => {
    const step = steps.get(stepId);
    if (!step || seen.has(stepId)) return 0; // missing step or a loop: stop counting
    const next = new Set([...seen, stepId]);
    return Math.max(0, ...step.actions.map((a) => 1 + (a.next ? depth(a.next, next) : 0)));
  };
  return depth(sim.start, new Set());
}

describe('quiz 2026.1: general', () => {
  it('has a sensible pass mark (between 0 and 1)', () => {
    expect(quiz.passMark).toBeGreaterThan(0);
    expect(quiz.passMark).toBeLessThanOrEqual(1);
  });

  it('every question and simulation id is unique across the whole quiz', () => {
    const ids = [...quiz.questions.map((q) => q.id), ...sims.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The checks below keep the quiz and schema.ts in step. If an id or answer would fail validation,
  // real staff would get "Invalid payload" when they submit.

  it('every authored id passes the submit schema’s id rule', () => {
    const ids = [
      ...quiz.questions.flatMap((q) => [q.id, ...q.options.map((o) => o.id)]),
      ...sims.flatMap((s) => [
        s.id,
        ...s.steps.flatMap((st) => [...st.actions.map((a) => a.id), ...(st.hotspots ?? []).map((h) => h.id)]),
      ]),
    ];
    for (const id of ids) expect(IdSchema.safeParse(id).success, `id "${id}" would be rejected`).toBe(true);
  });

  it('the quiz fits within the submit schema’s limits', () => {
    expect(quiz.questions.length + sims.length).toBeLessThanOrEqual(MAX_ANSWERED_ITEMS);
    for (const q of quiz.questions) expect(q.options.length).toBeLessThanOrEqual(MAX_PICKS_PER_ANSWER);
    // A simulation answer = actions on the route taken + hotspots tapped.
    // Worst case = the longest route + every hotspot in the scenario.
    for (const s of sims) {
      const worst = longestRoute(s) + s.steps.reduce((n, st) => n + (st.hotspots?.length ?? 0), 0);
      expect(worst, `${s.id} could need ${worst} ids`).toBeLessThanOrEqual(MAX_PICKS_PER_ANSWER);
    }
  });

  it('the public version leaks no answer keys', () => {
    const json = JSON.stringify(toPublicQuiz(quiz));
    for (const secret of ['"correct"', 'explanation', 'policyRef', 'actionResults', 'hotspotResults', 'feedback', 'minFlags', 'maxFalseFlags']) {
      expect(json, `public quiz contains ${secret}`).not.toContain(secret);
    }
  });
});

describe.each(quiz.questions.map((q) => [q.id, q] as const))('choice question %s', (_id, q) => {
  it('every correct id is a real option', () => {
    const optionIds = new Set(q.options.map((o) => o.id));
    expect(q.correct.length).toBeGreaterThan(0);
    for (const id of q.correct) expect(optionIds.has(id), `"${id}" is not an option`).toBe(true);
  });
  it('single / truefalse have exactly one correct answer', () => {
    if (q.type !== 'multi') expect(q.correct).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Simulations: the step graph and answer key must line up
// ─────────────────────────────────────────────────────────────────────────────

/** Text of the field a hotspot points at, so we can check its `match` really appears there. */
function hotspotFieldText(step: SimulationStep, target: string, index = 0): string | undefined {
  const s = step.screen;
  if (!s) return undefined;
  switch (s.kind) {
    case 'email':
      if (target === 'from') return `${s.from.name} ${s.from.address}`;
      if (target === 'replyTo') return s.replyTo;
      if (target === 'subject') return s.subject;
      if (target === 'body') return s.body;
      if (target === 'link') return s.links?.[index]?.href;
      if (target === 'attachment') return s.attachments?.[index];
      return undefined;
    case 'sms':
      if (target === 'from') return s.from;
      if (target === 'message') return s.messages[index];
      if (target === 'link') return s.links?.[index]?.href;
      return undefined;
    case 'chat':
    case 'call':
      if (target === 'message') return s.messages[index]?.text;
      if (target === 'sender') return s.messages[index]?.sender;
      return undefined;
    case 'webpage':
      if (target === 'url') return s.url;
      if (target === 'body') return s.body;
      return undefined;
  }
}

/** Is there at least one route that ends on 'best' with nothing 'unsafe' on the way? */
function hasWinningPath(sim: PrivateSimulationQuestion): boolean {
  const steps = new Map(sim.steps.map((s) => [s.id, s]));
  const search = (stepId: string, seen: Set<string>): boolean => {
    const step = steps.get(stepId);
    if (!step || seen.has(stepId)) return false; // missing step, or a loop
    for (const a of step.actions) {
      const verdict = sim.actionResults[a.id]?.verdict;
      if (verdict === 'unsafe') continue;              // this route is already lost
      if (!a.next && verdict === 'best') return true;  // a winning ending
      if (a.next && search(a.next, new Set([...seen, stepId]))) return true;
    }
    return false;
  };
  return search(sim.start, new Set());
}

describe.each(sims.map((s) => [s.id, s] as const))('simulation %s', (_id, sim) => {
  const stepIds = new Set(sim.steps.map((s) => s.id));
  const actions = sim.steps.flatMap((s) => s.actions);
  const hotspots = sim.steps.flatMap((s) => s.hotspots ?? []);

  it('step ids are unique, and `start` is one of them', () => {
    expect(stepIds.size).toBe(sim.steps.length);
    expect(stepIds.has(sim.start)).toBe(true);
  });

  it('action and hotspot ids are all unique (scoring tells them apart by id)', () => {
    const ids = [...actions.map((a) => a.id), ...hotspots.map((h) => h.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every `next` points at a real step, and every step has at least one action', () => {
    for (const a of actions) if (a.next) expect(stepIds.has(a.next), `${a.id} → missing step "${a.next}"`).toBe(true);
    for (const s of sim.steps) expect(s.actions.length, `step "${s.id}" is a dead end`).toBeGreaterThan(0);
  });

  it('every step can be reached from the start', () => {
    const reached = new Set<string>();
    const walk = (id: string) => {
      if (reached.has(id)) return;
      reached.add(id);
      sim.steps.find((s) => s.id === id)?.actions.forEach((a) => a.next && walk(a.next));
    };
    walk(sim.start);
    for (const id of stepIds) expect(reached.has(id), `step "${id}" is unreachable`).toBe(true);
  });

  it('answer key covers every action and hotspot, with no leftovers', () => {
    expect(Object.keys(sim.actionResults).sort()).toEqual(actions.map((a) => a.id).sort());
    expect(Object.keys(sim.hotspotResults).sort()).toEqual(hotspots.map((h) => h.id).sort());
  });

  it('every hotspot `match` really appears in the field it targets', () => {
    for (const s of sim.steps) {
      for (const h of s.hotspots ?? []) {
        const text = hotspotFieldText(s, h.target, h.index);
        expect(text, `${h.id}: target "${h.target}" is empty on step "${s.id}"`).toBeTruthy();
        if (h.match) expect(text, `${h.id}: "${h.match}" not found`).toContain(h.match);
      }
    }
  });

  it('minFlags is achievable (not more than the number of real flags)', () => {
    const realFlags = Object.values(sim.hotspotResults).filter((r) => r.isFlag).length;
    expect(sim.minFlags).toBeLessThanOrEqual(realFlags);
  });

  it('there is at least one winning route', () => {
    expect(hasWinningPath(sim)).toBe(true);
  });
});
