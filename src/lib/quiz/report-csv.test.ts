import { describe, expect, it } from 'vitest';
import { csvCell, reportToCsv } from './status';
import type { Report } from './types';

// Tests for the CSV export (status.ts → csvCell, reportToCsv), used by GET /api/quiz/report?format=csv.

describe('csvCell', () => {
  it('plain text and numbers pass through unchanged', () => {
    expect(csvCell('Alex Chen')).toBe('Alex Chen');
    expect(csvCell(85)).toBe('85');
    expect(csvCell(0)).toBe('0');
  });

  it('missing values become an empty cell', () => {
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(null)).toBe('');
  });

  it('commas, quotes and line breaks are quoted, inner quotes doubled', () => {
    expect(csvCell('Chen, Alex')).toBe('"Chen, Alex"');
    expect(csvCell('Alex "AJ" Chen')).toBe('"Alex ""AJ"" Chen"');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('formula injection: = + - @ tab and CR at the start are neutralised with an apostrophe', () => {
    expect(csvCell('=HYPERLINK("http://evil.test")')).toBe(`"'=HYPERLINK(""http://evil.test"")"`);
    expect(csvCell('+61 400 000 000')).toBe("'+61 400 000 000");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tx')).toBe("'\tx");
  });

  it('those characters in the middle are harmless and left alone', () => {
    expect(csvCell('Mary-Jane')).toBe('Mary-Jane');
    expect(csvCell('a@b.test')).toBe('a@b.test');
  });
});

describe('reportToCsv', () => {
  const report: Report = {
    quizVersion: '2026.1',
    quizTitle: 'Test',
    generatedAt: '2026-11-19T00:00:00.000Z',
    summary: { total: 2, done: 1, failed: 0, inProgress: 0, notStarted: 1 },
    rows: [
      { userId: 'u1', name: 'Sam', email: 'sam@x.test', quizVersion: '2026.1', status: 'not_started', bestScore: 0, attempts: 0 },
      {
        userId: 'u2', name: 'Chen, Alex', email: 'alex@x.test', quizVersion: '2026.1', status: 'completed',
        bestScore: 0.85, attempts: 2, completedAt: '2026-11-18T01:00:00.000Z', lastAttemptAt: '2026-11-18T02:00:00.000Z',
      },
    ],
  };
  const csv = reportToCsv(report);

  it('starts with a BOM (Excel UTF-8) and uses CRLF line endings, with a trailing newline', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('header + one line per row, in report order, with readable status and whole-number %', () => {
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'Name,Email,Status,Best score (%),Attempts,Completed at,Last attempt at',
      'Sam,sam@x.test,Not started,0,0,,',
      '"Chen, Alex",alex@x.test,Completed,85,2,2026-11-18T01:00:00.000Z,2026-11-18T02:00:00.000Z',
    ]);
  });

  it('an empty roster still produces the header', () => {
    expect(reportToCsv({ ...report, rows: [] })).toBe('﻿Name,Email,Status,Best score (%),Attempts,Completed at,Last attempt at\r\n');
  });
});
