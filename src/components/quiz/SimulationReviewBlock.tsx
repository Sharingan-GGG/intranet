import { Check, CircleAlert, Flag, Minus, X } from 'lucide-react';
import type { ActionVerdict, SimulationFailReason, SimulationQuestion, SimulationReview } from '../../lib/quiz/simulation.types';
import { fieldText, hotspotKey } from './simulation/play';
import { edge } from './ui';

// RESULT PAGE: "what happened" in one scenario, after submitting. A server component (display only).
//
// The server sends ids + verdicts + explanations (SimulationReview, built by reviewSimulation from
// the answer key, for the screens this person saw). The words themselves (action labels, the text
// that was tappable) come from the scenario's PUBLIC content, looked up here.
//
// Every status has a word AND an icon, never colour alone.

/** Plain-English reason a scenario counted as wrong. */
function reasonText(reason: SimulationFailReason, genuine: boolean): string {
  switch (reason) {
    case 'unsafe_action':
      return 'One of your choices was unsafe. Even with a good recovery afterwards, an unsafe step makes the scenario wrong.';
    case 'not_best_ending':
      return 'Your final choice was safe, but not the best response.';
    case 'not_enough_flags':
      return 'You missed important red flags.';
    case 'too_many_false_flags':
      return genuine
        ? 'This message was genuine, so nothing needed marking. Marked items count as false alarms.'
        : 'You marked more than one thing that wasn’t suspicious (false alarms).';
    case 'incomplete':
      return 'You didn’t finish the scenario.';
    case 'invalid_path':
      return 'This answer couldn’t be checked.';
  }
}

type Tone = 'good' | 'neutral' | 'bad';

/**
 * A choice's chip. 'ok' depends on WHERE it is: mid-scenario it's a fine step (e.g. "call the
 * supplier on a known number", which leads on); as the FINAL choice it's safe but not the best.
 */
function verdictChip(verdict: ActionVerdict, isLast: boolean): { tone: Tone; label: string } {
  if (verdict === 'best') return { tone: 'good', label: 'Best response' };
  if (verdict === 'unsafe') return { tone: 'bad', label: 'Unsafe' };
  return isLast ? { tone: 'neutral', label: 'Safe, but not the best' } : { tone: 'good', label: 'Good step' };
}

const TONE: Record<Tone, { className: string; Icon: typeof Check }> = {
  good: { className: 'bg-muted text-foreground', Icon: Check },
  neutral: { className: 'border border-foreground/20 text-foreground', Icon: Minus },
  bad: { className: 'bg-destructive/10 text-destructive', Icon: X },
};

/** The text a hotspot covered on screen (its `match`, or the whole field), for "you marked …". */
function hotspotText(sim: SimulationQuestion, hotspotId: string): string {
  for (const step of sim.steps) {
    const h = step.hotspots?.find((x) => x.id === hotspotId);
    if (h && step.screen) return h.match ?? fieldText(step.screen, hotspotKey(h)) ?? hotspotId;
  }
  return hotspotId;
}

function actionLabel(sim: SimulationQuestion, actionId: string): string {
  for (const step of sim.steps) {
    const a = step.actions.find((x) => x.id === actionId);
    if (a) return a.label;
  }
  return actionId;
}

/** One row: status chip (icon + word), the item, and why. */
function Row({ tone, status, children, why }: { tone: Tone; status: string; children: React.ReactNode; why: string }) {
  const { className, Icon } = TONE[tone];
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
          <Icon className="size-3" aria-hidden="true" />
          {status}
        </span>
        <span className="min-w-0 font-medium">{children}</span>
      </div>
      {why && <p className="text-muted-foreground">{why}</p>}
    </li>
  );
}

export function SimulationReviewBlock({ sim, review }: { sim: SimulationQuestion; review: SimulationReview }) {
  const realFlags = review.flags.filter((f) => f.isFlag);
  const falseAlarms = review.flags.filter((f) => !f.isFlag && f.marked);
  // Genuine message: every detail is explained as "fine", so people learn what makes it safe.
  const goodSigns = review.genuine ? review.flags.filter((f) => !f.isFlag && !f.marked) : [];

  return (
    <div className="flex flex-col gap-4">
      {review.reason && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {reasonText(review.reason, review.genuine)}
        </p>
      )}

      {review.choices.length > 0 && (
        <div>
          <p className="font-semibold">Your choices</p>
          <ol className="mt-2 flex flex-col gap-3">
            {review.choices.map((c, i) => {
              const chip = verdictChip(c.verdict, i === review.choices.length - 1);
              return (
                <Row key={c.actionId} tone={chip.tone} status={chip.label} why={c.feedback}>
                  {actionLabel(sim, c.actionId)}
                </Row>
              );
            })}
          </ol>
        </div>
      )}

      <div>
        <p className="flex items-center gap-1.5 font-semibold">
          <Flag className="size-4 text-destructive" aria-hidden="true" />
          {review.genuine ? 'This message was genuine' : 'The red flags'}
        </p>
        {review.genuine && (
          <p className="mt-1 text-muted-foreground">There was nothing to mark here. These details show it was safe:</p>
        )}
        <ul className="mt-2 flex flex-col gap-3">
          {realFlags.map((f) => (
            <Row key={f.hotspotId} tone={f.marked ? 'good' : 'bad'} status={f.marked ? 'Spotted' : 'Missed'} why={f.explanation}>
              “{hotspotText(sim, f.hotspotId)}”
            </Row>
          ))}
          {falseAlarms.map((f) => (
            <Row key={f.hotspotId} tone="bad" status="False alarm" why={f.explanation}>
              “{hotspotText(sim, f.hotspotId)}”
            </Row>
          ))}
          {goodSigns.map((f) => (
            <Row key={f.hotspotId} tone="good" status="Fine" why={f.explanation}>
              “{hotspotText(sim, f.hotspotId)}”
            </Row>
          ))}
        </ul>
        {!review.genuine && realFlags.length === 0 && falseAlarms.length === 0 && (
          <p className={`mt-2 rounded-lg ${edge} px-3 py-2 text-muted-foreground`}>No red flags on the screens you saw.</p>
        )}
      </div>
    </div>
  );
}
