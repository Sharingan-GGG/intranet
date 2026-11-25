// SIMULATION PLAYER LOGIC (browser side). Pure functions, no React. Tested in play.test.ts.
//
// Works on the PUBLIC simulation (no answer key). It only knows the step graph: which actions
// exist on each step and where they lead. Whether a choice was good is decided on the server.
//
// The answer format is the same one the server expects (see simulation-scoring.ts):
//   answers[simId] = [...action ids in the order taken, ...hotspot ids tapped]

import type { Hotspot, SimulationQuestion, SimulationScreen, SimulationStep } from '../../../lib/quiz/simulation.types';

// ─────────────────────────────────────────────────────────────────────────────
// Answer ⇄ play state
// ─────────────────────────────────────────────────────────────────────────────

export type PlayState = {
  /** Action ids taken, in order. */
  path: string[];
  /** Hotspot ids the player marked as suspicious (each once). */
  tapped: string[];
};

/** Splits a stored answer into path + taps. Action and hotspot ids are unique within a simulation. */
export function toPlayState(sim: SimulationQuestion, picks: readonly string[] = []): PlayState {
  const actionIds = new Set(sim.steps.flatMap((s) => s.actions.map((a) => a.id)));
  const path: string[] = [];
  const tapped = new Set<string>();
  for (const id of picks) {
    if (actionIds.has(id)) path.push(id);
    else tapped.add(id);
  }
  return { path, tapped: [...tapped] };
}

/** Play state → the answer array sent to the server. */
export function toPicks(state: PlayState): string[] {
  return [...state.path, ...state.tapped];
}

// ─────────────────────────────────────────────────────────────────────────────
// Walking the step graph
// ─────────────────────────────────────────────────────────────────────────────

export type Walk = {
  /** The step on screen now, or null when the last action ended the scenario. */
  current: SimulationStep | null;
  /** Steps the player has seen, in order (current included). */
  visited: SimulationStep[];
  /** Labels of the actions taken, for the review and result screens. */
  choices: string[];
};

/**
 * Follows the path from the start step. Mirrors checkPath on the server: an action that isn't on
 * the current step stops the walk there (can only happen with stale saved data).
 */
export function walk(sim: SimulationQuestion, path: readonly string[]): Walk {
  const steps = new Map(sim.steps.map((s) => [s.id, s]));
  let current: SimulationStep | null = steps.get(sim.start) ?? null;
  const visited: SimulationStep[] = current ? [current] : [];
  const choices: string[] = [];

  for (const actionId of path) {
    const action = current?.actions.find((a) => a.id === actionId);
    if (!current || !action) break;
    choices.push(action.label);
    current = action.next ? (steps.get(action.next) ?? null) : null; // no `next` = the scenario ends
    if (current) visited.push(current);
  }
  return { current, visited, choices };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepping back and forth inside a scenario
// ─────────────────────────────────────────────────────────────────────────────
//
// `view` = which decision screen is on show: 0 = the first screen, 1 = the screen after the first
// choice, and so on. On a screen the player already decided, path[view] is their choice: it stays
// highlighted, and they can keep it (Next) or pick another (chooseAt).

/**
 * Furthest screen that can be shown.
 * Unfinished: the screen waiting for a decision (path.length).
 * Finished: the screen with the final choice (path.length - 1). There's no separate "finished" screen.
 */
export function maxView(sim: SimulationQuestion, path: readonly string[]): number {
  const w = walk(sim, path);
  const taken = w.choices.length; // ignores any stale actions walk() couldn't follow
  return taken > 0 && w.current === null ? taken - 1 : taken;
}

/** Keeps a view inside 0..maxView (saved data may be out of range). */
export function clampView(sim: SimulationQuestion, path: readonly string[], view: number): number {
  return Math.min(Math.max(Math.trunc(view) || 0, 0), maxView(sim, path));
}

/**
 * The player picks `actionId` on screen `view`.
 *  - Same as their earlier choice: nothing changes (the rest of their path is kept).
 *  - Different: the path is cut there and the new choice added. Later screens depended on the
 *    old choice, so they're dropped, and so are flags marked on screens no longer reached
 *    (the server rejects flags on screens the player never saw). Flags on earlier screens stay.
 */
export function chooseAt(sim: SimulationQuestion, picks: readonly string[], view: number, actionId: string): string[] {
  const { path, tapped } = toPlayState(sim, picks);
  if (path[view] === actionId) return [...picks];
  const newPath = [...path.slice(0, view), actionId];
  const visible = new Set(walk(sim, newPath).visited.flatMap((s) => (s.hotspots ?? []).map((h) => h.id)));
  return toPicks({ path: newPath, tapped: tapped.filter((id) => visible.has(id)) });
}

/**
 * Makes a saved answer valid before submitting, in case it is stale (e.g. saved in this tab before
 * the scenario was edited). The server would reject an impossible answer with a 400, so:
 *   - the path is cut at the first action that isn't on the current step,
 *   - taps are kept only for hotspots on steps the player actually reached.
 */
export function cleanPicks(sim: SimulationQuestion, picks: readonly string[] | undefined): string[] {
  const { path, tapped } = toPlayState(sim, picks);
  const w = walk(sim, path);
  const validPath = path.slice(0, w.choices.length);
  const visible = new Set(w.visited.flatMap((s) => (s.hotspots ?? []).map((h) => h.id)));
  return toPicks({ path: validPath, tapped: tapped.filter((id) => visible.has(id)) });
}

/** Finished = at least one action, and the last one ended the scenario. */
export function isSimulationFinished(sim: SimulationQuestion, picks: readonly string[] | undefined): boolean {
  const { path } = toPlayState(sim, picks);
  return path.length > 0 && walk(sim, path).current === null;
}

/** Started = any action taken or any flag marked. */
export function isSimulationStarted(picks: readonly string[] | undefined): boolean {
  return (picks?.length ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hotspots: which text on screen can be tapped
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every tappable piece of a screen is a "field", named by a key:
 *   'from' | 'replyTo' | 'subject' | 'body' | 'url'          single fields
 *   'attachment:0' | 'link:0' | 'message:2' | 'sender:2'     fields that come in a list
 * A hotspot belongs to the field with the same key.
 */
const LIST_TARGETS = new Set(['attachment', 'link', 'message', 'sender']);

export function hotspotKey(h: Pick<Hotspot, 'target' | 'index'>): string {
  return LIST_TARGETS.has(h.target) ? `${h.target}:${h.index ?? 0}` : h.target;
}

/** The visible text of a field, or undefined if that field isn't on this screen. */
export function fieldText(screen: SimulationScreen, key: string): string | undefined {
  const [target, rawIndex] = key.split(':');
  const i = Number(rawIndex ?? 0);
  switch (screen.kind) {
    case 'email':
      if (target === 'from') return `${screen.from.name} <${screen.from.address}>`;
      if (target === 'replyTo') return screen.replyTo;
      if (target === 'subject') return screen.subject;
      if (target === 'body') return screen.body;
      if (target === 'attachment') return screen.attachments?.[i];
      if (target === 'link') return screen.links?.[i]?.text;
      return undefined;
    case 'sms':
      if (target === 'from') return screen.from;
      if (target === 'message') return screen.messages[i];
      if (target === 'link') return screen.links?.[i]?.text;
      return undefined;
    case 'chat':
    case 'call':
      if (target === 'message') return screen.messages[i]?.text;
      if (target === 'sender') return screen.messages[i]?.sender;
      return undefined;
    case 'webpage':
      if (target === 'url') return screen.url;
      if (target === 'body') return screen.body;
      return undefined;
  }
}

/** A piece of text: plain, or a tappable hotspot. */
export type Segment = { text: string; hotspotId?: string };

/**
 * Cuts a field's text into plain and tappable pieces.
 *  - A hotspot WITHOUT `match` makes the whole field one tappable piece.
 *  - A hotspot WITH `match` makes its first occurrence of that text tappable.
 *  - Overlapping matches: the earlier one wins, the later one is skipped (never nested).
 * Tested against every hotspot in the real question bank (play.test.ts).
 */
export function segmentText(text: string, spots: readonly Hotspot[]): Segment[] {
  const whole = spots.find((h) => !h.match);
  if (whole) return [{ text, hotspotId: whole.id }];

  const ranges = spots
    .map((h) => ({ id: h.id, start: text.indexOf(h.match!), length: h.match!.length }))
    .filter((r) => r.start >= 0)
    .sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue; // overlaps the previous one
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) });
    out.push({ text: text.slice(r.start, r.start + r.length), hotspotId: r.id });
    pos = r.start + r.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** The hotspots of a step, grouped by field key, for quick lookup while rendering. */
export function hotspotsByField(step: SimulationStep): Map<string, Hotspot[]> {
  const map = new Map<string, Hotspot[]>();
  for (const h of step.hotspots ?? []) {
    const key = hotspotKey(h);
    map.set(key, [...(map.get(key) ?? []), h]);
  }
  return map;
}
