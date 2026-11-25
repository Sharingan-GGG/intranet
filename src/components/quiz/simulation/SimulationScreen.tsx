'use client';

import { Eye, Flag, Globe, Mail, MessageSquare, Paperclip, Phone } from 'lucide-react';
import { useState } from 'react';
import type { Hotspot, SimulationScreen as Screen } from '../../../lib/quiz/simulation.types';
import { edge } from '../ui';
import { segmentText } from './play';

// Draws one simulated screen (email, text message, chat, phone call, web page) and makes its
// hotspots tappable. Nothing here is a real link or a real form: it's a picture you can tap.
//
// HOTSPOTS
//   Every hotspot (real red flag OR decoy, they look identical) is a toggle button in a small dashed
//   box. Hover turns it red; tapping marks it as suspicious (red fill + flag icon); tapping again unmarks it.
//   aria-pressed tells screen readers whether it's marked.
//
// LINKS look like real links (blue, underlined) and never go anywhere. Where a link REALLY goes is
// hidden until the player checks, like in a real email: hovering (or keyboard focus) shows the
// address in a status strip at the bottom of the screen, the way a browser shows it bottom-left.
// Touch screens can't hover, so each link gets a small "Preview" button there instead.
// Screen readers get the address read out after the link text.

type Props = {
  screen: Screen;
  /** This step's hotspots, grouped by field key (see play.ts → hotspotsByField). */
  spots: Map<string, Hotspot[]>;
  tapped: ReadonlySet<string>;
  onToggle: (hotspotId: string) => void;
};

export function SimulationScreen(props: Props) {
  const { screen } = props;
  switch (screen.kind) {
    case 'email':
      return <EmailView {...props} screen={screen} />;
    case 'sms':
      return <SmsView {...props} screen={screen} />;
    case 'chat':
    case 'call':
      return <ConversationView {...props} screen={screen} />;
    case 'webpage':
      return <WebPageView {...props} screen={screen} />;
  }
}

// ─── Building block: a piece of text with tappable parts ─────────────────────

/** Blue underlined text, so a simulated link looks like a link. Part of the pretend email, not the quiz UI. */
const LINK_TEXT = 'text-blue-700 underline underline-offset-2 dark:text-blue-400';

type FieldProps = Omit<Props, 'screen'> & { fieldKey: string; text: string; link?: boolean };

function Field({ fieldKey, text, spots, tapped, onToggle, link = false }: FieldProps) {
  return (
    <>
      {segmentText(text, spots.get(fieldKey) ?? []).map((seg, i) =>
        seg.hotspotId ? (
          <HotspotButton key={i} id={seg.hotspotId} text={seg.text} pressed={tapped.has(seg.hotspotId)} onToggle={onToggle} link={link} />
        ) : (
          <span key={i} className={link ? LINK_TEXT : undefined}>
            {seg.text}
          </span>
        ),
      )}
    </>
  );
}

type HotspotProps = { id: string; text: string; pressed: boolean; onToggle: (id: string) => void; link: boolean };

function HotspotButton({ id, text, pressed, onToggle, link }: HotspotProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      // detail > 1 = the second click of a double-click: ignored, so it doesn't instantly unmark.
      onClick={(e) => e.detail < 2 && onToggle(id)}
      // A small boxed "chip" so tappable parts stand out from plain text. Red (the theme's
      // `destructive` colour) on hover and when marked: it's a RED flag. Every hotspot, real or
      // decoy, gets the same box, so the styling never gives the answer away.
      // box-decoration-clone: when a long hotspot wraps onto two lines, each line gets its own box.
      className={`mx-px inline rounded-md border px-1 py-px text-left whitespace-pre-line box-decoration-clone transition-colors ${
        pressed
          ? 'border-destructive bg-destructive font-medium text-background'
          : `border-dashed border-foreground/40 bg-muted/60 hover:border-solid hover:border-destructive hover:bg-destructive/10 hover:text-destructive ${link ? LINK_TEXT : ''}`
      }`}
    >
      {pressed && <Flag className="mr-1 inline size-3 align-[-1px]" aria-hidden="true" />}
      {text}
    </button>
  );
}

/**
 * Frame shared by every screen: a small title bar with an icon, then the content.
 * `status` (screens with links only): the strip at the bottom showing where the link being
 * checked really goes. `undefined` = no strip; `null` = strip with the "hover a link" hint.
 */
function Frame({ icon, title, status, children }: { icon: React.ReactNode; title: string; status?: string | null; children: React.ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-xl ${edge} bg-card text-sm`}>
      <div className="flex items-center gap-2 border-b border-foreground/15 bg-muted px-4 py-2 text-xs font-semibold text-foreground/80">
        {icon}
        {title}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
      {status !== undefined && (
        // aria-hidden: screen readers already hear the address after each link (see Links).
        <div aria-hidden="true" className="flex min-h-9 items-center gap-2 border-t border-foreground/15 bg-muted px-4 py-2 text-xs">
          <Globe className="size-3.5 shrink-0 text-muted-foreground" />
          {status ? (
            <span className="font-mono break-all">{status}</span>
          ) : (
            <span className="text-muted-foreground">
              <span className="pointer-coarse:hidden">Hover over a link to see where it really goes</span>
              <span className="hidden pointer-coarse:inline">Tap Preview next to a link to see where it really goes</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function EmailView({ screen, ...p }: Props & { screen: Extract<Screen, { kind: 'email' }> }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <Frame icon={<Mail className="size-3.5" aria-hidden="true" />} title="Email" status={screen.links?.length ? preview : undefined}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-foreground/10 pb-3">
        <dt className="text-muted-foreground">From</dt>
        <dd className="min-w-0 break-words">
          <Field {...p} fieldKey="from" text={`${screen.from.name} <${screen.from.address}>`} />
        </dd>
        {screen.replyTo && (
          <>
            <dt className="text-muted-foreground">Reply-to</dt>
            <dd className="min-w-0 break-words">
              <Field {...p} fieldKey="replyTo" text={screen.replyTo} />
            </dd>
          </>
        )}
        {screen.to && (
          <>
            <dt className="text-muted-foreground">To</dt>
            <dd>{screen.to}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Received</dt>
        <dd>{screen.receivedAt}</dd>
      </dl>
      <p className="mt-3 text-base font-semibold">
        <Field {...p} fieldKey="subject" text={screen.subject} />
      </p>
      <p className="mt-3 leading-relaxed whitespace-pre-line">
        <Field {...p} fieldKey="body" text={screen.body} />
      </p>
      <Links links={screen.links} preview={preview} onPreview={setPreview} {...p} />
      {screen.attachments?.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {screen.attachments.map((name, i) => (
            <li key={i} className={`inline-flex items-center gap-1.5 rounded-md ${edge} bg-muted/50 px-2 py-1`}>
              <Paperclip className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Attachment: </span>
              <Field {...p} fieldKey={`attachment:${i}`} text={name} />
            </li>
          ))}
        </ul>
      ) : null}
    </Frame>
  );
}

type LinksProps = Omit<Props, 'screen'> & {
  links?: { text: string; href: string }[];
  preview: string | null;
  onPreview: (href: string | null) => void;
};

/**
 * Links as they'd appear in a real message: just the link text. Where it really goes shows in the
 * frame's status strip on hover / focus (or the Preview button on touch screens).
 * Clicking the link itself marks it as a red flag, like any other hotspot. It never navigates.
 */
function Links({ links, preview, onPreview, ...p }: LinksProps) {
  if (!links?.length) return null;
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {links.map((l, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2">
          {/* React's onFocus / onBlur bubble, so keyboard focus on the link button shows the preview too. */}
          <span
            className="font-medium"
            onMouseEnter={() => onPreview(l.href)}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(l.href)}
            onBlur={() => onPreview(null)}
          >
            <Field {...p} fieldKey={`link:${i}`} text={l.text} link />
            <span className="sr-only"> (link to {l.href})</span>
          </span>
          {/* Touch screens only (no hover there). Hidden from screen readers: they hear the address above. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => onPreview(preview === l.href ? null : l.href)}
            className={`hidden items-center gap-1 rounded-md ${edge} bg-card px-2 py-1 text-xs font-medium pointer-coarse:inline-flex`}
          >
            <Eye className="size-3.5" />
            {preview === l.href ? 'Hide' : 'Preview'}
          </button>
        </li>
      ))}
    </ul>
  );
}

function SmsView({ screen, ...p }: Props & { screen: Extract<Screen, { kind: 'sms' }> }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <Frame icon={<MessageSquare className="size-3.5" aria-hidden="true" />} title="Text message" status={screen.links?.length ? preview : undefined}>
      <p className="font-medium">
        <Field {...p} fieldKey="from" text={screen.from} />
      </p>
      <p className="text-xs text-muted-foreground">{screen.receivedAt}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {screen.messages.map((m, i) => (
          <li key={i} className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 leading-relaxed">
            <Field {...p} fieldKey={`message:${i}`} text={m} />
          </li>
        ))}
      </ul>
      <Links links={screen.links} preview={preview} onPreview={setPreview} {...p} />
    </Frame>
  );
}

function ConversationView({ screen, ...p }: Props & { screen: Extract<Screen, { kind: 'chat' | 'call' }> }) {
  const Icon = screen.kind === 'call' ? Phone : MessageSquare;
  return (
    <Frame icon={<Icon className="size-3.5" aria-hidden="true" />} title={screen.app}>
      <ul className="flex flex-col gap-3">
        {screen.messages.map((m, i) => (
          <li key={i} className={`flex flex-col gap-1 ${m.isMe ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-muted-foreground">
              <Field {...p} fieldKey={`sender:${i}`} text={m.sender} />
              {m.time && ` · ${m.time}`}
            </span>
            <span
              className={`max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed ${
                m.isMe ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-muted'
              }`}
            >
              <Field {...p} fieldKey={`message:${i}`} text={m.text} />
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function WebPageView({ screen, ...p }: Props & { screen: Extract<Screen, { kind: 'webpage' }> }) {
  return (
    <Frame icon={<Globe className="size-3.5" aria-hidden="true" />} title="Web page">
      <p className={`rounded-md ${edge} bg-muted/50 px-3 py-1.5 font-mono text-xs break-all`}>
        <span className="sr-only">Address: </span>
        <Field {...p} fieldKey="url" text={screen.url} />
      </p>
      <p className="mt-4 text-base font-semibold">{screen.title}</p>
      <p className="mt-2 leading-relaxed whitespace-pre-line">
        <Field {...p} fieldKey="body" text={screen.body} />
      </p>
      {screen.fields?.length ? (
        // A picture of a form: inert on purpose, nothing can be typed or sent.
        <div className="mt-4 flex flex-col gap-2" aria-label="Form shown on the page (not usable)" role="group" inert>
          {screen.fields.map((f) => (
            <div key={f} className={`rounded-md ${edge} px-3 py-2 text-muted-foreground`}>
              {f}
            </div>
          ))}
        </div>
      ) : null}
    </Frame>
  );
}
