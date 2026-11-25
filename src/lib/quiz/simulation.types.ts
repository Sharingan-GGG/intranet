import type { Topic } from './types';

/*
 * Interactive simulation questions ("mini-games").
 *
 * A simulation is a small graph of steps. Each step shows something on screen (an email, a text,
 * a chat, a phone call or a web page), lets the player tap suspicious parts of it (hotspots), and
 * offers actions (open attachment, report, reply, call…). An action either moves to another step
 * or ends the scenario.
 *
 * Public vs private:
 * - `SimulationQuestion` is safe to send to the browser: content, hotspots and actions only.
 *   It includes decoy hotspots, so the browser can't tell which ones are real red flags.
 * - `PrivateSimulationQuestion` adds the answer key (verdict per action, which hotspots are real
 *   flags) and the teaching notes. Server-only.
 *
 * Submitting: answers[questionId] = [...action ids in the order taken, ...hotspot ids tapped].
 * Action and hotspot ids are unique within a question, so the server can tell them apart.
 *
 * Scoring (see simulation-scoring.ts): the question is correct when
 *   1. the last action taken has the verdict 'best',
 *   2. no action on the path has the verdict 'unsafe' (a good recovery after a mistake still
 *      gets 'best' feedback, but the question counts as wrong), and
 *   3. the player found at least `minFlags` real red flags, and
 *   4. didn't mark more than `maxFalseFlags` things that AREN'T red flags ("false alarms").
 * 'ok' = harmless but not ideal: fine as a step along the way, not as an ending.
 * `minFlags` and `maxFalseFlags` are PRIVATE: a per-scenario number gave answers away. Players get
 * the general rule instead ("mark what looks suspicious; some messages are genuine"), shown in
 * the How-it-works window and on the first scenario of each attempt.
 */

// ---------- What is on screen ----------

/** A link as the player sees it (text) vs where it really goes (href). Never actually clickable. */
export interface SimulatedLink {
  text: string;
  href: string;
}

export interface EmailScreen {
  kind: 'email';
  from: { name: string; address: string };
  replyTo?: string;          // set when it differs from `from`
  to?: string;               // "Me" or a distribution list
  subject: string;
  receivedAt: string;        // "Today, 9:42 am"
  body: string;              // plain text; paragraphs separated by a blank line
  links?: SimulatedLink[];
  attachments?: string[];    // "Invoice_8812.pdf.exe"
}

export interface SmsScreen {
  kind: 'sms';
  from: string;              // sender name or number as the phone shows it
  receivedAt: string;
  messages: string[];        // one bubble per entry, in order
  links?: SimulatedLink[];
}

/** Chat apps and phone-call transcripts: a back-and-forth between people. */
export interface ConversationScreen {
  kind: 'chat' | 'call';
  app: string;               // "Google Chat", "WhatsApp", "Phone call"
  messages: { sender: string; time?: string; text: string; isMe?: boolean }[];
}

/** A web page the player lands on, e.g. a fake sign-in page after clicking a link. */
export interface WebPageScreen {
  kind: 'webpage';
  url: string;               // shown in the fake address bar
  title: string;
  body: string;
  fields?: string[];         // form fields shown, e.g. ['Email', 'Password']
}

export type SimulationScreen = EmailScreen | SmsScreen | ConversationScreen | WebPageScreen;

// ---------- What the player can interact with ----------

/** Which part of the screen a hotspot covers. */
export type HotspotTarget =
  | 'from' | 'replyTo' | 'subject' | 'body'      // email
  | 'link' | 'attachment'                         // email / sms
  | 'message' | 'sender'                          // sms / chat / call
  | 'url';                                        // webpage

/** A tappable area. Real flags and decoys look the same in the public data. */
export interface Hotspot {
  id: string;
  target: HotspotTarget;
  index?: number;            // which link / attachment / message (0-based) when there are several
  match?: string;            // exact substring to highlight inside that field; omit for the whole field
}

export type ActionKind =
  | 'open_attachment' | 'click_link' | 'reply' | 'forward' | 'report' | 'delete'
  | 'call_known_number' | 'enter_details' | 'close' | 'ignore' | 'other';

export interface SimulationAction {
  id: string;
  kind: ActionKind;          // lets the UI choose an icon / button style
  label: string;             // "Open the attachment"
  next?: string;             // step id to go to; omitted = this action ends the scenario
}

export interface SimulationStep {
  id: string;
  narration?: string;        // short scene-setting text above the screen
  screen?: SimulationScreen; // omitted = narration-only step ("A window flashes and disappears…")
  hotspots?: Hotspot[];
  actions: SimulationAction[];
}

// ---------- The question ----------

/** What the browser receives: no answers. */
export interface SimulationQuestion {
  id: string;
  topic: Topic;
  type: 'simulation';
  title: string;             // shown on the card / level select
  brief: string;             // instructions for the player
  start: string;             // id of the first step
  steps: SimulationStep[];
}

export type ActionVerdict = 'best' | 'ok' | 'unsafe';

/** Server only: answer key + teaching notes. */
export interface PrivateSimulationQuestion extends SimulationQuestion {
  /**
   * Real red flags the player must find for the question to count as correct (0 = a genuine
   * message). PRIVATE since Nov 2026: showing "find at least N" gave answers away (N = 0 meant
   * "this one is safe"). Players get the general rule instead (see simulation-scoring.ts).
   */
  minFlags: number;
  /**
   * Most "false alarms" (marked things that aren't red flags) still allowed. Default: 0 for a
   * genuine message (nothing to find, so any mark is wrong), 1 otherwise (one honest slip is OK).
   */
  maxFalseFlags?: number;
  /** Verdict and feedback for every action id in `steps`. */
  actionResults: Record<string, { verdict: ActionVerdict; feedback: string }>;
  /** Every hotspot id in `steps`: whether it's a real red flag, and why. */
  hotspotResults: Record<string, { isFlag: boolean; explanation: string }>;
  explanation: string;       // summary shown after the scenario
  policyRef?: string;
}

/**
 * Strip the answer key before sending a simulation to the browser.
 * Allow-list: only the fields named here are copied. A field added to
 * PrivateSimulationQuestion later stays private unless someone adds it here on purpose.
 * (`steps` holds only public content: screens, hotspot positions, action labels.)
 */
export function toPublicSimulation(q: PrivateSimulationQuestion): SimulationQuestion {
  return {
    id: q.id,
    topic: q.topic,
    type: q.type,
    title: q.title,
    brief: q.brief,
    start: q.start,
    steps: q.steps,
    // minFlags is NOT copied: it would reveal how many flags there are (0 = "it's genuine").
  };
}

/**
 * After submitting: what happened in one scenario, for the result page. Ids only: the page
 * already has the scenario's public text (labels, hotspot text) and looks them up.
 * Built by reviewSimulation (simulation-scoring.ts) from the private answer key.
 */
export interface SimulationReview {
  /** Why it counted as wrong (only when it did). */
  reason?: SimulationFailReason;
  /** True when the screens the player saw had no red flags at all: a genuine message. */
  genuine: boolean;
  /** Each action taken, in order, with its verdict and why. */
  choices: { actionId: string; verdict: ActionVerdict; feedback: string }[];
  /**
   * Hotspots worth explaining, on screens the player saw: every REAL flag (spotted or missed),
   * every false alarm they marked, and, for a genuine message, every hotspot (why it's fine).
   */
  flags: { hotspotId: string; isFlag: boolean; marked: boolean; explanation: string }[];
}

/** Why a simulation was marked wrong. The first rule that failed, checked in the order listed. */
export type SimulationFailReason =
  | 'invalid_path'          // tampered or broken client (sanitize should have rejected it already)
  | 'incomplete'            // never reached an ending
  | 'unsafe_action'         // took at least one 'unsafe' action
  | 'not_best_ending'       // ended on an 'ok' action
  | 'not_enough_flags'      // found fewer than minFlags real red flags
  | 'too_many_false_flags'; // marked more non-flags than maxFalseFlags allows
