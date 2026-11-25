// Pure scoring logic for interactive simulations: no I/O, no framework imports.
// Unit-tested in simulation-scoring.test.ts.
//
// HOW A SIMULATION ANSWER ARRIVES
//   answers[simulationId] = [...action ids in the order the player took them, ...hotspot ids tapped]
//   e.g. ['call-hotel', 'report-after-call', 'h-domain', 'h-attachment']
//
//   Action ids and hotspot ids are unique within one simulation (checked by questions.test.ts),
//   so we can sort each id into "action" or "hotspot" just by looking it up.
//
// WHEN IS A SIMULATION CORRECT? (all five must be true)
//   1. The path is complete: the player reached an ending (an action with no `next`).
//   2. No action on the path is 'unsafe'. A good recovery after a mistake still counts as wrong.
//   3. The LAST action is 'best'. Ending on an 'ok' action (harmless but not ideal) is wrong.
//   4. The player marked at least `minFlags` REAL red flags.
//   5. The player marked no more than `maxFalseFlags` things that AREN'T red flags ("false alarms").
//      Default: 0 on a genuine message (nothing to find, so any mark means they didn't trust a
//      safe message), 1 otherwise (one honest slip is forgiven). Without this rule, once the
//      numbers are hidden, "mark everything" would always find every flag.
//
// THE RULE IS KNOWN, THE NUMBERS ARE NOT (changed Nov 2026)
//   Earlier, each scenario said "Find at least N red flags". That gave answers away (N = 0 meant
//   "this one is genuine"). Now the GENERAL rule is explained up front (How-it-works window, and
//   on the first scenario of each attempt): mark what looks suspicious, some messages are genuine,
//   false alarms count. minFlags / maxFalseFlags stay private. (Earlier still, when there was no
//   explanation at all, people who made every right decision scored 0%: the rule itself must
//   always be visible.)
//
// AFTER SUBMITTING: reviewSimulation explains every real flag (spotted / missed), every false
// alarm, and every choice, using the answer key's explanations (see the result page).

import type { ActionVerdict, PrivateSimulationQuestion, SimulationFailReason, SimulationReview } from './simulation.types';

export type { SimulationFailReason } from './simulation.types';

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: split the submitted ids into actions and hotspots
// ─────────────────────────────────────────────────────────────────────────────

export interface SplitAnswer {
  path: string[];      // action ids, order kept (order matters: it's the route through the scenario)
  tapped: string[];    // hotspot ids, duplicates removed (order doesn't matter)
  unknown: string[];   // ids that are neither, which means a tampered or broken client
}

export function splitSimulationAnswer(sim: PrivateSimulationQuestion, picks: readonly string[]): SplitAnswer {
  // Build lookup sets of every action id and hotspot id in the whole scenario.
  const actionIds = new Set(sim.steps.flatMap((s) => s.actions.map((a) => a.id)));
  const hotspotIds = new Set(sim.steps.flatMap((s) => (s.hotspots ?? []).map((h) => h.id)));

  const path: string[] = [];
  const tapped = new Set<string>(); // a Set, so tapping the same flag twice counts once
  const unknown: string[] = [];

  for (const id of picks) {
    if (actionIds.has(id)) path.push(id);
    else if (hotspotIds.has(id)) tapped.add(id);
    else unknown.push(id);
  }
  return { path, tapped: [...tapped], unknown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: walk the path through the step graph
// ─────────────────────────────────────────────────────────────────────────────

export interface PathCheck {
  valid: boolean;          // every action was available on the step the player was on
  complete: boolean;       // the last action ended the scenario
  visitedSteps: string[];  // step ids the player actually saw (used to ignore hotspots on unseen steps)
  error?: string;          // why the path is invalid, for sanitizeSimulationAnswer
}

export function checkPath(sim: PrivateSimulationQuestion, path: readonly string[]): PathCheck {
  const steps = new Map(sim.steps.map((s) => [s.id, s]));
  let current = steps.get(sim.start); // the player always begins on the start step
  const visitedSteps: string[] = current ? [current.id] : [];

  for (const actionId of path) {
    // The previous action already ended the scenario, so nothing more can be clicked.
    if (!current) {
      return { valid: false, complete: false, visitedSteps, error: `Action "${actionId}" comes after the scenario ended` };
    }
    // The action must be one of the buttons on THIS step. This stops someone submitting
    // the winning ending without playing through the steps before it.
    const action = current.actions.find((a) => a.id === actionId);
    if (!action) {
      return { valid: false, complete: false, visitedSteps, error: `Action "${actionId}" is not available on step "${current.id}"` };
    }
    // Move on. No `next` means this action ends the scenario (current becomes undefined).
    current = action.next ? steps.get(action.next) : undefined;
    if (current) visitedSteps.push(current.id);
  }

  // Complete = at least one action taken, and we finished on an ending (current is undefined).
  return { valid: true, complete: path.length > 0 && current === undefined, visitedSteps };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: count real red flags (only on steps the player actually saw)
// ─────────────────────────────────────────────────────────────────────────────

export function countRealFlags(
  sim: PrivateSimulationQuestion,
  tapped: readonly string[],
  visitedSteps: readonly string[],
): number {
  // Which hotspots were on screen for this player?
  const visited = new Set(visitedSteps);
  const visibleHotspots = new Set(
    sim.steps.filter((s) => visited.has(s.id)).flatMap((s) => (s.hotspots ?? []).map((h) => h.id)),
  );
  // Count a tap only if it was visible AND the answer key marks it as a real flag.
  // A hotspot missing from hotspotResults counts as a decoy (safe default).
  // `new Set(tapped)` removes duplicates, so tapping the same flag twice counts once.
  return [...new Set(tapped)].filter((id) => visibleHotspots.has(id) && sim.hotspotResults[id]?.isFlag === true)
    .length;
}

/** Taps on visible hotspots that are NOT real red flags ("false alarms"). */
export function countFalseFlags(
  sim: PrivateSimulationQuestion,
  tapped: readonly string[],
  visitedSteps: readonly string[],
): number {
  const visited = new Set(visitedSteps);
  const visibleHotspots = new Set(
    sim.steps.filter((s) => visited.has(s.id)).flatMap((s) => (s.hotspots ?? []).map((h) => h.id)),
  );
  return [...new Set(tapped)].filter((id) => visibleHotspots.has(id) && sim.hotspotResults[id]?.isFlag !== true).length;
}

/** Does the scenario contain any real red flag at all? No = a genuine message. */
export function hasRealFlags(sim: PrivateSimulationQuestion): boolean {
  return Object.values(sim.hotspotResults).some((r) => r.isFlag);
}

/** False alarms allowed: the scenario's own setting, else 0 for a genuine message and 1 otherwise. */
export function allowedFalseFlags(sim: PrivateSimulationQuestion): number {
  return sim.maxFalseFlags ?? (hasRealFlags(sim) ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: put it together
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulationEvaluation {
  correct: boolean;
  reason?: SimulationFailReason; // set only when correct is false
  verdicts: ActionVerdict[];     // verdict of each action on the path, in order (handy for feedback screens)
  flagsFound: number;            // real red flags spotted
  flagsNeeded: number;           // minFlags
  flagsTotal: number;            // real red flags on the screens the player saw
  falseFlags: number;            // marked things that aren't red flags
  falseFlagsAllowed: number;     // allowedFalseFlags
}

/**
 * Red flags spotted: real flags tapped / real flags on the screens the player saw.
 * Flags on steps they never reached aren't counted in either number. An invalid path → 0 / 0.
 */
export function flagSummary(sim: PrivateSimulationQuestion, picks: readonly string[] | undefined): { found: number; total: number } {
  const { path, tapped } = splitSimulationAnswer(sim, picks ?? []);
  const check = checkPath(sim, path);
  if (!check.valid) return { found: 0, total: 0 };
  const visited = new Set(check.visitedSteps);
  const total = sim.steps
    .filter((s) => visited.has(s.id))
    .flatMap((s) => s.hotspots ?? [])
    .filter((h) => sim.hotspotResults[h.id]?.isFlag === true).length;
  return { found: countRealFlags(sim, tapped, check.visitedSteps), total };
}

export function evaluateSimulation(
  sim: PrivateSimulationQuestion,
  picks: readonly string[] | undefined,
): SimulationEvaluation {
  const { path, tapped } = splitSimulationAnswer(sim, picks ?? []);
  const check = checkPath(sim, path);

  // An action missing from actionResults is treated as 'unsafe', so a gap in the answer key
  // can never accidentally mark someone correct. questions.test.ts checks there are no gaps.
  const verdicts = path.map((id) => sim.actionResults[id]?.verdict ?? 'unsafe');
  const flagsFound = check.valid ? countRealFlags(sim, tapped, check.visitedSteps) : 0;
  const falseFlags = check.valid ? countFalseFlags(sim, tapped, check.visitedSteps) : 0;
  const base = {
    verdicts,
    flagsFound,
    flagsNeeded: sim.minFlags,
    flagsTotal: flagSummary(sim, picks).total,
    falseFlags,
    falseFlagsAllowed: allowedFalseFlags(sim),
  };

  // The rules, in order. The first one that fails is the reason reported.
  if (!check.valid) return { ...base, correct: false, reason: 'invalid_path' };
  if (!check.complete) return { ...base, correct: false, reason: 'incomplete' };
  if (verdicts.includes('unsafe')) return { ...base, correct: false, reason: 'unsafe_action' };
  if (verdicts[verdicts.length - 1] !== 'best') return { ...base, correct: false, reason: 'not_best_ending' };
  if (flagsFound < sim.minFlags) return { ...base, correct: false, reason: 'not_enough_flags' };
  if (falseFlags > base.falseFlagsAllowed) return { ...base, correct: false, reason: 'too_many_false_flags' };
  return { ...base, correct: true };
}

/**
 * What happened, for the result page (after submitting). Uses the private answer key, but only
 * for what the player actually saw: hotspots on steps they never reached aren't mentioned.
 *  - every REAL red flag on those screens: spotted or missed, and why it's a red flag
 *  - every false alarm they marked, and why it's fine
 *  - genuine message (no real flags on those screens): EVERY hotspot, so they learn what makes it safe
 *  - every action taken, with its verdict and feedback
 * An invalid path (tampered) gets an empty review.
 */
export function reviewSimulation(sim: PrivateSimulationQuestion, picks: readonly string[] | undefined): SimulationReview {
  const evaluation = evaluateSimulation(sim, picks);
  const { path, tapped } = splitSimulationAnswer(sim, picks ?? []);
  const check = checkPath(sim, path);
  const reason = evaluation.correct ? undefined : evaluation.reason;
  if (!check.valid) return { reason, genuine: false, choices: [], flags: [] };

  const marked = new Set(tapped);
  const visited = new Set(check.visitedSteps);
  const seen = sim.steps.filter((s) => visited.has(s.id)).flatMap((s) => s.hotspots ?? []);
  const genuine = !seen.some((h) => sim.hotspotResults[h.id]?.isFlag === true);

  const flags = seen
    .map((h) => {
      const r = sim.hotspotResults[h.id];
      return { hotspotId: h.id, isFlag: r?.isFlag === true, marked: marked.has(h.id), explanation: r?.explanation ?? '' };
    })
    .filter((f) => genuine || f.isFlag || f.marked);

  const choices = path.map((actionId) => ({
    actionId,
    verdict: sim.actionResults[actionId]?.verdict ?? ('unsafe' as ActionVerdict),
    feedback: sim.actionResults[actionId]?.feedback ?? '',
  }));

  return { reason, genuine, choices, flags };
}

/** Shortcut used by scoreAttempt: just true / false. */
export function isSimulationCorrect(sim: PrivateSimulationQuestion, picks: readonly string[] | undefined): boolean {
  return evaluateSimulation(sim, picks).correct;
}

// ─────────────────────────────────────────────────────────────────────────────
// Never trust the browser: validate before scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rejects: unknown ids, impossible paths (skipping steps, clicking after the end),
 * and taps on hotspots from steps the player never reached.
 * An INCOMPLETE path is allowed through: it isn't tampering, the player just didn't finish,
 * and scoring marks it wrong.
 * Returns cleaned picks: [...path, ...unique hotspot taps].
 */
export function sanitizeSimulationAnswer(
  sim: PrivateSimulationQuestion,
  picks: readonly string[],
): { ok: true; picks: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const { path, tapped, unknown } = splitSimulationAnswer(sim, picks);

  if (unknown.length) errors.push(`Unknown id(s) ${unknown.join(', ')} for simulation "${sim.id}"`);

  const check = checkPath(sim, path);
  if (!check.valid) errors.push(`Simulation "${sim.id}": ${check.error}`);

  // Hotspots must belong to a step the player actually reached.
  const visited = new Set(check.visitedSteps);
  const reachable = new Set(
    sim.steps.filter((s) => visited.has(s.id)).flatMap((s) => (s.hotspots ?? []).map((h) => h.id)),
  );
  const unseen = tapped.filter((id) => !reachable.has(id));
  if (check.valid && unseen.length) {
    errors.push(`Simulation "${sim.id}": hotspot(s) ${unseen.join(', ')} are on steps the player never reached`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, picks: [...path, ...tapped] };
}
