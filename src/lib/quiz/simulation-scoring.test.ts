import { describe, expect, it } from 'vitest';
import {
  checkPath,
  allowedFalseFlags,
  countRealFlags,
  evaluateSimulation,
  flagSummary,
  hasRealFlags,
  isSimulationCorrect,
  reviewSimulation,
  sanitizeSimulationAnswer,
  splitSimulationAnswer,
} from './simulation-scoring';
import { toPublicSimulation, type PrivateSimulationQuestion } from './simulation.types';

/*
 * A tiny made-up scenario, so these tests don't break when the real questions are edited.
 *
 *   step "inbox"  hotspots: h-real-1 ✓flag, h-real-2 ✓flag, h-decoy ✗decoy
 *     ├─ a-unsafe ──────────────► END   (unsafe)
 *     ├─ a-best ────────────────► END   (best)
 *     └─ a-check ─► step "check" (ok)   hotspots: h-later ✓flag
 *                     ├─ a-best-after ► END (best)
 *                     └─ a-ok-end ────► END (ok)
 *
 *   minFlags = 2
 */
const sim: PrivateSimulationQuestion = {
  id: 'sim-test',
  topic: 'phishing',
  type: 'simulation',
  title: 'Test',
  brief: 'Test brief',
  start: 'inbox',
  steps: [
    {
      id: 'inbox',
      screen: {
        kind: 'email',
        from: { name: 'Sender', address: 'sender@example.com' },
        subject: 'Subject',
        receivedAt: 'Today',
        body: 'Body',
      },
      hotspots: [
        { id: 'h-real-1', target: 'from' },
        { id: 'h-real-2', target: 'subject' },
        { id: 'h-decoy', target: 'body' },
      ],
      actions: [
        { id: 'a-unsafe', kind: 'open_attachment', label: 'Unsafe' },
        { id: 'a-best', kind: 'report', label: 'Best' },
        { id: 'a-check', kind: 'call_known_number', label: 'Check', next: 'check' },
      ],
    },
    {
      id: 'check',
      narration: 'Narration-only step',
      hotspots: [{ id: 'h-later', target: 'body' }],
      actions: [
        { id: 'a-best-after', kind: 'report', label: 'Best after check' },
        { id: 'a-ok-end', kind: 'delete', label: 'OK ending' },
      ],
    },
  ],
  actionResults: {
    'a-unsafe': { verdict: 'unsafe', feedback: 'secret-unsafe' },
    'a-best': { verdict: 'best', feedback: 'secret-best' },
    'a-check': { verdict: 'ok', feedback: 'secret-check' },
    'a-best-after': { verdict: 'best', feedback: 'secret-best-after' },
    'a-ok-end': { verdict: 'ok', feedback: 'secret-ok-end' },
  },
  hotspotResults: {
    'h-real-1': { isFlag: true, explanation: 'secret-flag-1' },
    'h-real-2': { isFlag: true, explanation: 'secret-flag-2' },
    'h-decoy': { isFlag: false, explanation: 'secret-decoy' },
    'h-later': { isFlag: true, explanation: 'secret-later' },
  },
  minFlags: 2,
  explanation: 'secret-explanation',
  policyRef: 'Policy s.11',
};

describe('splitSimulationAnswer', () => {
  it('separates actions (order kept) from hotspots (deduped) and unknown ids', () => {
    expect(splitSimulationAnswer(sim, ['h-real-1', 'a-check', 'h-real-1', 'a-best-after', 'zzz'])).toEqual({
      path: ['a-check', 'a-best-after'],
      tapped: ['h-real-1'],
      unknown: ['zzz'],
    });
  });
});

describe('checkPath', () => {
  it('a one-click ending is valid and complete', () => {
    expect(checkPath(sim, ['a-best'])).toMatchObject({ valid: true, complete: true, visitedSteps: ['inbox'] });
  });
  it('a two-step route is valid and records both steps as visited', () => {
    expect(checkPath(sim, ['a-check', 'a-best-after'])).toMatchObject({
      valid: true,
      complete: true,
      visitedSteps: ['inbox', 'check'],
    });
  });
  it('stopping halfway is valid but NOT complete', () => {
    expect(checkPath(sim, ['a-check'])).toMatchObject({ valid: true, complete: false });
  });
  it('no actions at all is not complete', () => {
    expect(checkPath(sim, [])).toMatchObject({ valid: true, complete: false });
  });
  it('skipping straight to a later step’s action is invalid', () => {
    expect(checkPath(sim, ['a-best-after']).valid).toBe(false);
  });
  it('clicking anything after the scenario ended is invalid', () => {
    expect(checkPath(sim, ['a-best', 'a-check']).valid).toBe(false);
  });
});

describe('countRealFlags', () => {
  it('counts real flags only, ignores decoys and duplicates', () => {
    expect(countRealFlags(sim, ['h-real-1', 'h-real-1', 'h-decoy'], ['inbox'])).toBe(1);
  });
  it('ignores flags on steps the player never reached', () => {
    expect(countRealFlags(sim, ['h-later'], ['inbox'])).toBe(0);
    expect(countRealFlags(sim, ['h-later'], ['inbox', 'check'])).toBe(1);
  });
});

describe('evaluateSimulation: the four rules', () => {
  it('correct: best ending, nothing unsafe, enough flags', () => {
    expect(evaluateSimulation(sim, ['a-best', 'h-real-1', 'h-real-2'])).toMatchObject({
      correct: true,
      flagsFound: 2,
      flagsNeeded: 2,
      flagsTotal: 2,
      verdicts: ['best'],
    });
  });
  it('correct: an "ok" step along the way is fine if the ending is "best"', () => {
    expect(isSimulationCorrect(sim, ['a-check', 'a-best-after', 'h-real-1', 'h-real-2'])).toBe(true);
  });
  it('flags found on a later step count once the player reaches it', () => {
    expect(isSimulationCorrect(sim, ['a-check', 'a-best-after', 'h-real-1', 'h-later'])).toBe(true);
  });
  it('rule 1: unanswered or unfinished → incomplete', () => {
    expect(evaluateSimulation(sim, undefined).reason).toBe('incomplete');
    expect(evaluateSimulation(sim, ['a-check', 'h-real-1', 'h-real-2']).reason).toBe('incomplete');
  });
  it('rule 2: any unsafe action → wrong', () => {
    expect(evaluateSimulation(sim, ['a-unsafe', 'h-real-1', 'h-real-2']).reason).toBe('unsafe_action');
  });
  it('rule 3: ending on an "ok" action → wrong', () => {
    expect(evaluateSimulation(sim, ['a-check', 'a-ok-end', 'h-real-1', 'h-real-2']).reason).toBe('not_best_ending');
  });
  it('rule 4: too few real flags → wrong (decoys don’t help)', () => {
    expect(evaluateSimulation(sim, ['a-best', 'h-real-1', 'h-decoy'])).toMatchObject({
      correct: false,
      reason: 'not_enough_flags',
      flagsFound: 1,
    });
    expect(evaluateSimulation(sim, ['a-best']).reason).toBe('not_enough_flags');
  });
  it('marking every flag never rescues an unsafe action', () => {
    expect(evaluateSimulation(sim, ['a-unsafe', 'h-real-1', 'h-real-2']).correct).toBe(false);
  });
  it('an impossible path is never correct, even if it ends on a "best" action', () => {
    expect(evaluateSimulation(sim, ['a-best-after', 'h-real-1', 'h-real-2']).reason).toBe('invalid_path');
  });
  it('an action missing from the answer key is treated as unsafe (safe default)', () => {
    const gap = { ...sim, actionResults: { ...sim.actionResults } };
    delete gap.actionResults['a-best'];
    expect(evaluateSimulation(gap, ['a-best', 'h-real-1', 'h-real-2']).reason).toBe('unsafe_action');
  });
});

describe('flagSummary (shown on the result)', () => {
  it('real flags spotted out of those on the screens the player saw', () => {
    expect(flagSummary(sim, ['a-best', 'h-real-1', 'h-decoy'])).toEqual({ found: 1, total: 2 });
  });
  it('a later step adds its flags to the total once reached', () => {
    expect(flagSummary(sim, ['a-check', 'a-best-after', 'h-later'])).toEqual({ found: 1, total: 3 });
  });
  it('nothing tapped → 0 found; invalid path → 0 / 0', () => {
    expect(flagSummary(sim, ['a-best'])).toEqual({ found: 0, total: 2 });
    expect(flagSummary(sim, ['a-best-after'])).toEqual({ found: 0, total: 0 });
  });
});

describe('sanitizeSimulationAnswer', () => {
  it('accepts a valid answer and returns [...path, ...unique taps]', () => {
    expect(sanitizeSimulationAnswer(sim, ['h-real-1', 'a-best', 'h-real-1'])).toEqual({
      ok: true,
      picks: ['a-best', 'h-real-1'],
    });
  });
  it('lets an unfinished path through (scoring marks it wrong, it isn’t tampering)', () => {
    expect(sanitizeSimulationAnswer(sim, ['a-check']).ok).toBe(true);
  });
  it('rejects unknown ids', () => {
    expect(sanitizeSimulationAnswer(sim, ['a-best', 'nope']).ok).toBe(false);
  });
  it('rejects impossible paths', () => {
    expect(sanitizeSimulationAnswer(sim, ['a-best-after']).ok).toBe(false);
  });
  it('rejects taps on hotspots from steps the player never reached', () => {
    expect(sanitizeSimulationAnswer(sim, ['a-best', 'h-later']).ok).toBe(false);
  });
});

describe('toPublicSimulation', () => {
  it('strips verdicts, flag answers, explanations and policy refs', () => {
    const json = JSON.stringify(toPublicSimulation(sim));
    expect(json).not.toContain('secret-');        // every feedback/explanation string in the fixture starts with this
    expect(json).not.toContain('actionResults');
    expect(json).not.toContain('hotspotResults');
    expect(json).not.toContain('minFlags');       // private: "find N" gave answers away (N = 0 meant genuine)
    expect(json).not.toContain('maxFalseFlags');
    expect(json).not.toContain('policyRef');
    expect(json).toContain('"start":"inbox"');    // but the playable content is still there
    expect(json).toContain('h-decoy');            // decoys AND real flags are both sent, indistinguishable
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// False alarms (rule 5) and the post-submit review
// ─────────────────────────────────────────────────────────────────────────────

/** The same scenario as a GENUINE message: every hotspot is harmless, nothing to find. */
const genuine: PrivateSimulationQuestion = {
  ...sim,
  minFlags: 0,
  hotspotResults: Object.fromEntries(Object.entries(sim.hotspotResults).map(([id, r]) => [id, { ...r, isFlag: false }])),
};

describe('rule 5: false alarms', () => {
  it('a message WITH red flags forgives one false alarm', () => {
    expect(allowedFalseFlags(sim)).toBe(1);
    expect(evaluateSimulation(sim, ['a-best', 'h-real-1', 'h-real-2', 'h-decoy'])).toMatchObject({ correct: true, falseFlags: 1 });
  });

  it('…but not more than the scenario allows (maxFalseFlags overrides the default)', () => {
    const strict = { ...sim, maxFalseFlags: 0 };
    expect(evaluateSimulation(strict, ['a-best', 'h-real-1', 'h-real-2', 'h-decoy'])).toMatchObject({
      correct: false,
      reason: 'too_many_false_flags',
    });
  });

  it('a GENUINE message: marking nothing + the best action is right; marking anything is wrong', () => {
    expect(hasRealFlags(genuine)).toBe(false);
    expect(allowedFalseFlags(genuine)).toBe(0);
    expect(evaluateSimulation(genuine, ['a-best']).correct).toBe(true);
    expect(evaluateSimulation(genuine, ['a-best', 'h-decoy'])).toMatchObject({ correct: false, reason: 'too_many_false_flags' });
  });

  it('"mark everything" no longer works: missing nothing, but too many false alarms', () => {
    const everything = { ...sim, maxFalseFlags: 0 };
    expect(evaluateSimulation(everything, ['a-best', 'h-real-1', 'h-real-2', 'h-decoy']).reason).toBe('too_many_false_flags');
  });

  it('missing flags is reported before false alarms (the more important lesson)', () => {
    expect(evaluateSimulation({ ...sim, maxFalseFlags: 0 }, ['a-best', 'h-decoy']).reason).toBe('not_enough_flags');
  });
});

describe('reviewSimulation (shown after submitting)', () => {
  it('explains every real flag on the screens seen (spotted or missed), false alarms, and every choice', () => {
    const r = reviewSimulation(sim, ['a-check', 'a-best-after', 'h-real-1', 'h-decoy']);
    expect(r.genuine).toBe(false);
    expect(r.reason).toBe('not_enough_flags'); // 1 real flag of the 2 needed
    expect(r.choices).toEqual([
      { actionId: 'a-check', verdict: 'ok', feedback: 'secret-check' },
      { actionId: 'a-best-after', verdict: 'best', feedback: 'secret-best-after' },
    ]);
    expect(r.flags).toEqual([
      { hotspotId: 'h-real-1', isFlag: true, marked: true, explanation: 'secret-flag-1' },
      { hotspotId: 'h-real-2', isFlag: true, marked: false, explanation: 'secret-flag-2' },
      { hotspotId: 'h-decoy', isFlag: false, marked: true, explanation: 'secret-decoy' },
      { hotspotId: 'h-later', isFlag: true, marked: false, explanation: 'secret-later' },
    ]);
  });

  it('never mentions screens the player didn’t reach, or decoys they didn’t mark', () => {
    const r = reviewSimulation(sim, ['a-best', 'h-real-1', 'h-real-2']);
    expect(r.reason).toBeUndefined(); // correct
    expect(r.flags.map((f) => f.hotspotId)).toEqual(['h-real-1', 'h-real-2']);
  });

  it('a genuine message explains EVERY detail seen (why it’s fine), marked ones as false alarms', () => {
    const r = reviewSimulation(genuine, ['a-best', 'h-decoy']);
    expect(r.genuine).toBe(true);
    expect(r.reason).toBe('too_many_false_flags');
    expect(r.flags.map((f) => [f.hotspotId, f.marked])).toEqual([
      ['h-real-1', false],
      ['h-real-2', false],
      ['h-decoy', true],
    ]);
  });

  it('a tampered path gets an empty review', () => {
    expect(reviewSimulation(sim, ['a-best-after'])).toEqual({ reason: 'invalid_path', genuine: false, choices: [], flags: [] });
  });
});
