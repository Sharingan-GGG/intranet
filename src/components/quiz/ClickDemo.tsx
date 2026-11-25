'use client';

import { MousePointer2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

// A small looping "watch me click" animation for the How-it-works window:
// a cursor glides to a target, presses it (with a ripple), the target changes state, then it resets.
//
// HOW TO USE
//   Put the scene inside <ClickDemo>. Mark:
//     data-demo-target   the element the cursor clicks (it also gets a little press)
//     data-demo-on       anything that should APPEAR after the click (e.g. the flagged highlight)
//     data-demo-off      anything that should DISAPPEAR after the click (e.g. "Marked: 0")
//
// WHY THE WEB ANIMATIONS API (element.animate) AND NOT CSS @keyframes
//   Keyframes are global CSS names, and quiz.css must add nothing global to the Intranet.
//   element.animate() needs no stylesheet at all, and stops when the component unmounts.
//
// ACCESSIBILITY
//   - The whole demo is decorative (aria-hidden): the text next to it explains the same thing.
//   - prefers-reduced-motion: no movement; it simply shows the "after the click" state.
//   - Only transform and opacity animate (smooth, no layout shift).

const DURATION = 3600; // one loop, ms
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'; // quick start, gentle arrival

export function ClickDemo({ children, className = '' }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = box.current;
    const pointer = cursor.current;
    const ring = ripple.current;
    if (!container || !pointer || !ring) return;
    const target = container.querySelector<HTMLElement>('[data-demo-target]');
    if (!target) return;

    const on = [...container.querySelectorAll<HTMLElement>('[data-demo-on]')];
    const off = [...container.querySelectorAll<HTMLElement>('[data-demo-off]')];
    let running: Animation[] = [];

    const start = () => {
      running.forEach((a) => a.cancel());
      running = [];

      // Where to click: the centre of the target, relative to the demo box.
      const b = container.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const x = t.left - b.left + t.width / 2;
      const y = t.top - b.top + t.height / 2;
      const fromX = b.width - 28; // cursor starts near the bottom-right corner
      const fromY = b.height - 20;
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        // Still picture of the end state: cursor on the target, target already clicked.
        pointer.style.transform = `translate(${x}px, ${y}px)`;
        pointer.style.opacity = '1';
        on.forEach((el) => (el.style.opacity = '1'));
        off.forEach((el) => (el.style.opacity = '0'));
        return;
      }

      const loop = { duration: DURATION, iterations: Infinity, easing: 'linear' } as const;
      const at = (px: number, py: number, scale = 1) => `translate(${px}px, ${py}px) scale(${scale})`;

      running = [
        // Cursor: fade in, glide to the target, press, rest, fade out back to the corner.
        pointer.animate(
          [
            { offset: 0, transform: at(fromX, fromY), opacity: 0 },
            { offset: 0.08, transform: at(fromX, fromY), opacity: 1, easing: EASE },
            { offset: 0.36, transform: at(x, y), opacity: 1 },
            { offset: 0.41, transform: at(x, y, 0.82), opacity: 1 }, // press
            { offset: 0.47, transform: at(x, y), opacity: 1 }, // release
            { offset: 0.86, transform: at(x, y), opacity: 1 },
            { offset: 1, transform: at(x, y), opacity: 0 },
          ],
          loop,
        ),
        // Ripple where it clicked.
        ring.animate(
          [
            { offset: 0, transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
            { offset: 0.41, transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.35 },
            { offset: 0.66, transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
            { offset: 1, transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
          ],
          loop,
        ),
        // The target gives a little "pressed" dip.
        target.animate(
          [
            { offset: 0, transform: 'scale(1)' },
            { offset: 0.4, transform: 'scale(1)' },
            { offset: 0.43, transform: 'scale(0.96)' },
            { offset: 0.5, transform: 'scale(1)' },
            { offset: 1, transform: 'scale(1)' },
          ],
          loop,
        ),
        // State change at the moment of the click, undone just before the loop restarts.
        ...on.map((el) =>
          el.animate(
            [
              { offset: 0, opacity: 0 },
              { offset: 0.42, opacity: 0 },
              { offset: 0.46, opacity: 1 },
              { offset: 0.9, opacity: 1 },
              { offset: 0.97, opacity: 0 },
              { offset: 1, opacity: 0 },
            ],
            loop,
          ),
        ),
        ...off.map((el) =>
          el.animate(
            [
              { offset: 0, opacity: 1 },
              { offset: 0.42, opacity: 1 },
              { offset: 0.46, opacity: 0 },
              { offset: 0.9, opacity: 0 },
              { offset: 0.97, opacity: 1 },
              { offset: 1, opacity: 1 },
            ],
            loop,
          ),
        ),
      ];
    };

    start();
    // If the window is resized, the target moves: recompute and restart.
    const observer = new ResizeObserver(() => start());
    observer.observe(container);
    return () => {
      observer.disconnect();
      running.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div ref={box} aria-hidden="true" className={`relative overflow-hidden rounded-lg border bg-muted/40 p-4 select-none ${className}`}>
      {children}
      <span ref={ripple} className="pointer-events-none absolute size-16 rounded-full bg-foreground opacity-0" />
      <div ref={cursor} className="pointer-events-none absolute top-0 left-0 opacity-0">
        {/* The pointer's tip is its top-left corner, so it sits exactly on the click point. */}
        <MousePointer2 className="size-5 fill-foreground stroke-background drop-shadow" strokeWidth={1.5} />
      </div>
    </div>
  );
}
