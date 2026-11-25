import { describe, expect, it, vi } from 'vitest';
import type { SimulationQuestion } from '../../../lib/quiz/simulation.types';
import {
  chooseAt,
  clampView,
  cleanPicks,
  fieldText,
  hotspotKey,
  isSimulationFinished,
  maxView,
  segmentText,
  toPicks,
  toPlayState,
  walk,
} from './play';

vi.mock('server-only', () => ({})); // the real question bank is server-only

// A tiny scenario: start → (check → end) or (bad → end immediately)
const sim: SimulationQuestion = {
  id: 'sim-x',
  topic: 'phishing',
  type: 'simulation',
  title: 'T',
  brief: 'B',
  start: 's1',
  steps: [
    {
      id: 's1',
      screen: { kind: 'email', from: { name: 'A', address: 'a@x.co' }, subject: 'Pay now', receivedAt: 'today', body: 'Hello. Pay by 3 pm. Thanks.' },
      hotspots: [{ id: 'h1', target: 'body', match: 'Pay by 3 pm' }],
      actions: [
        { id: 'check', kind: 'other', label: 'Check', next: 's2' },
        { id: 'bad', kind: 'click_link', label: 'Click the link' },
      ],
    },
    { id: 's2', narration: 'Checked.', actions: [{ id: 'report', kind: 'report', label: 'Report it' }] },
  ],
};

describe('play state', () => {
  it('splits and rebuilds the answer (path order kept, taps de-duplicated)', () => {
    const state = toPlayState(sim, ['check', 'h1', 'report', 'h1']);
    expect(state).toEqual({ path: ['check', 'report'], tapped: ['h1'] });
    expect(toPicks(state)).toEqual(['check', 'report', 'h1']);
  });
});

describe('walk', () => {
  it('starts on the start step', () => {
    expect(walk(sim, []).current?.id).toBe('s1');
  });
  it('follows actions; an action without next ends the scenario', () => {
    const w = walk(sim, ['check', 'report']);
    expect(w.current).toBeNull();
    expect(w.visited.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(w.choices).toEqual(['Check', 'Report it']);
  });
  it('stops at an action that is not on the current step (stale data)', () => {
    expect(walk(sim, ['report']).current?.id).toBe('s1');
  });
  it('finished only when the scenario ended', () => {
    expect(isSimulationFinished(sim, undefined)).toBe(false);
    expect(isSimulationFinished(sim, ['h1'])).toBe(false);
    expect(isSimulationFinished(sim, ['check'])).toBe(false);
    expect(isSimulationFinished(sim, ['bad'])).toBe(true);
    expect(isSimulationFinished(sim, ['check', 'report', 'h1'])).toBe(true);
  });
});

describe('cleanPicks', () => {
  it('keeps a valid answer as it is', () => {
    expect(cleanPicks(sim, ['check', 'report', 'h1'])).toEqual(['check', 'report', 'h1']);
  });
  it('cuts an impossible path and drops unknown taps', () => {
    expect(cleanPicks(sim, ['report', 'h1', 'h-gone'])).toEqual(['h1']);
  });
});

describe('segmentText', () => {
  it('cuts out a matched hotspot', () => {
    expect(segmentText('Hello. Pay by 3 pm. Thanks.', [{ id: 'h1', target: 'body', match: 'Pay by 3 pm' }])).toEqual([
      { text: 'Hello. ' },
      { text: 'Pay by 3 pm', hotspotId: 'h1' },
      { text: '. Thanks.' },
    ]);
  });
  it('a hotspot without match covers the whole field', () => {
    expect(segmentText('abc', [{ id: 'w', target: 'url' }])).toEqual([{ text: 'abc', hotspotId: 'w' }]);
  });
  it('several matches in order; overlapping ones are skipped, never nested', () => {
    const segs = segmentText('one two three', [
      { id: 'b', target: 'body', match: 'three' },
      { id: 'a', target: 'body', match: 'one two' },
      { id: 'c', target: 'body', match: 'two' },
    ]);
    expect(segs).toEqual([{ text: 'one two', hotspotId: 'a' }, { text: ' ' }, { text: 'three', hotspotId: 'b' }]);
  });
  it('no hotspots → one plain piece', () => {
    expect(segmentText('plain', [])).toEqual([{ text: 'plain' }]);
  });
});

describe('hotspotKey', () => {
  it('list targets get an index, single fields do not', () => {
    expect(hotspotKey({ target: 'message', index: 2 })).toBe('message:2');
    expect(hotspotKey({ target: 'link' })).toBe('link:0');
    expect(hotspotKey({ target: 'subject' })).toBe('subject');
  });
});

// ─── The real question bank: every hotspot must be findable on its screen ─────

describe('real simulations (questions.2026.1.ts)', async () => {
  const { SIMULATION_QUESTIONS } = await import('../../../lib/quiz/questions.2026.1');

  it('every hotspot points at a field that exists, and its match text is in that field', () => {
    const problems: string[] = [];
    for (const s of SIMULATION_QUESTIONS) {
      for (const step of s.steps) {
        for (const h of step.hotspots ?? []) {
          const text = step.screen ? fieldText(step.screen, hotspotKey(h)) : undefined;
          if (text === undefined) problems.push(`${s.id}/${step.id}/${h.id}: field ${hotspotKey(h)} not on screen`);
          else if (h.match && !text.includes(h.match)) problems.push(`${s.id}/${step.id}/${h.id}: "${h.match}" not found`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('every hotspot is reachable as its own tappable piece (no overlaps hide one)', () => {
    const hidden: string[] = [];
    for (const s of SIMULATION_QUESTIONS) {
      for (const step of s.steps) {
        if (!step.screen) continue;
        const byKey = new Map<string, typeof step.hotspots>();
        for (const h of step.hotspots ?? []) byKey.set(hotspotKey(h), [...(byKey.get(hotspotKey(h)) ?? []), h]);
        for (const [key, spots] of byKey) {
          const shown = new Set(segmentText(fieldText(step.screen, key) ?? '', spots!).map((x) => x.hotspotId));
          for (const h of spots!) if (!shown.has(h.id)) hidden.push(`${s.id}/${step.id}/${h.id}`);
        }
      }
    }
    expect(hidden).toEqual([]);
  });

  it('every scenario can be finished', () => {
    for (const s of SIMULATION_QUESTIONS) {
      // Take the first action on each step until the scenario ends (max 20 steps).
      const path: string[] = [];
      let w = walk(s, path);
      for (let i = 0; i < 20 && w.current; i++) {
        path.push(w.current.actions[0].id);
        w = walk(s, path);
      }
      expect(isSimulationFinished(s, path), s.id).toBe(true);
    }
  });
});

describe('stepping back and forth (maxView / clampView / chooseAt)', () => {
  // Same scenario, but the second screen has its own flag, to test what happens to it.
  const sim2: SimulationQuestion = {
    ...sim,
    steps: [sim.steps[0], { ...sim.steps[1], hotspots: [{ id: 'h2', target: 'body' }] }],
  };

  it('maxView: the waiting screen when unfinished, the final-choice screen when finished', () => {
    expect(maxView(sim, [])).toBe(0); // nothing chosen: first screen
    expect(maxView(sim, ['check'])).toBe(1); // waiting on screen 2
    expect(maxView(sim, ['check', 'report'])).toBe(1); // finished on screen 2: no extra "finished" screen
    expect(maxView(sim, ['bad'])).toBe(0); // finished on screen 1
    expect(maxView(sim, ['report'])).toBe(0); // stale path: ignored
  });

  it('clampView keeps saved views in range', () => {
    expect(clampView(sim, ['check'], 5)).toBe(1);
    expect(clampView(sim, ['check'], -2)).toBe(0);
    expect(clampView(sim, ['check'], Number.NaN)).toBe(0);
  });

  it('chooseAt: picking the same answer again keeps everything after it', () => {
    const picks = ['check', 'report', 'h1', 'h2'];
    expect(chooseAt(sim2, picks, 0, 'check')).toEqual(picks);
  });

  it('chooseAt: a different answer drops later choices and flags on screens no longer reached', () => {
    // Was: check → report, flags on both screens. Change screen 1 to "bad" (ends the scenario).
    expect(chooseAt(sim2, ['check', 'report', 'h1', 'h2'], 0, 'bad')).toEqual(['bad', 'h1']);
  });

  it('chooseAt: deciding a new screen just adds the choice', () => {
    expect(chooseAt(sim2, ['check', 'h1'], 1, 'report')).toEqual(['check', 'report', 'h1']);
  });
});
