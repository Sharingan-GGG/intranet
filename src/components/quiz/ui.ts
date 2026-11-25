// SHARED CLASS NAMES for the quiz screens. Minimal black and white, built ONLY from the host's
// shadcn theme tokens (bg-card, border, text-muted-foreground, bg-primary, text-destructive…),
// so inside the Intranet the quiz follows the Intranet's theme, including dark mode.
//
// Buttons: always the shadcn <Button> from "@/components/ui/button".
//   For a LINK that looks like a button, use buttonVariants on next/link:
//     <Link href="…" className={buttonVariants({ size: 'lg' })}>Start</Link>
//
// Colour is never the only signal: every state also has text or an icon
// (e.g. a tick AND the word "Correct").

/**
 * A rounded card, like shadcn's <Card>. Add padding: `${card} p-6`.
 * The border is the TEXT colour at low opacity (not the theme's `border` token, which is so pale on
 * white that cards and buttons disappeared into the page). Text colour flips in dark mode, so the
 * edge stays visible in both themes. The soft shadow lifts the card off the page.
 */
export const card = 'rounded-xl border border-foreground/15 bg-card text-card-foreground shadow-sm';

/** Edge for smaller boxes inside a card (screens, choices, notes). Same idea as `card`. */
export const edge = 'border border-foreground/15';

/** Numbered step marker, e.g. the "1" in "1 · Read the message". */
export const stepNumber =
  'flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background';

/** Small uppercase label above a heading, e.g. "PHISHING & SCAMS". */
export const eyebrow = 'text-xs font-medium tracking-wide text-muted-foreground uppercase';

/** Paragraphs of reading text: ~65 characters per line, comfortable to read. */
export const readable = 'max-w-prose';

/** Comfortable tap size for the main actions (shadcn's lg is 36px; this makes it 40px). */
export const bigButton = 'h-10 px-4';
