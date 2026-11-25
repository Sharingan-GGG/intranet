import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// SAFETY NET for the Intranet: quiz.css is imported into the Intranet's global stylesheet, so a
// careless edit could restyle the whole Intranet. These tests fail if quiz.css ever:
//   - styles html / body / :root / * (or any selector) outside the .ctg-quiz wrapper
//   - defines theme tokens (they could overwrite the Intranet's shadcn colours)
//   - loads Tailwind or any other stylesheet itself (the host app does that once)

const css = readFileSync(path.join(__dirname, 'quiz.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ''); // ignore comments: they mention html/body when explaining the rules

/** Every selector of every style rule (at-rule headers like @media / @layer are skipped). */
function selectors(): string[] {
  const out: string[] = [];
  for (const m of css.matchAll(/([^{};]+)\{/g)) {
    const head = m[1].trim();
    if (!head || head.startsWith('@')) continue;
    out.push(...head.split(',').map((s) => s.trim()));
  }
  return out;
}

describe('quiz.css cannot affect the Intranet', () => {
  it('every style rule is scoped to .ctg-quiz', () => {
    const list = selectors();
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) expect(s.startsWith('.ctg-quiz')).toBe(true);
  });

  it('defines no theme tokens or custom properties', () => {
    expect(css).not.toMatch(/@theme/);
    expect(css).not.toMatch(/--[\w-]+\s*:/);
  });

  it('does not load Tailwind or any other stylesheet', () => {
    expect(css).not.toMatch(/@import/);
  });
});
