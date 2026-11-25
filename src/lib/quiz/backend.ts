import 'server-only';
import { Pool, type QueryResultRow } from 'pg';
import { parseAdminRoleValues, rolesFromIntranetRoles } from './roles';
import type { QuizOpenEvent, StoredAttempt, User } from './types';

// STORAGE: where attempts and "opened the quiz" markers are saved and loaded.
//
// `QuizBackend` is the CONTRACT: what storage must be able to do, not how.
// The rest of the app only talks to getBackend(), so swapping storage touches nothing else.
//
// INTRANET PORT: one implementation, PgBackend, talking straight to Postgres.
//   The standalone repo used supabase-js with the service-role key, which needs the schema in
//   Supabase's "Exposed schemas" list. This is the same choice the Audit Hub made
//   (src/lib/audit-db.ts): every caller is server-side, `payload_app` OWNS the cybersecurity_quiz
//   tables (so RLS doesn't apply to it), and no service-role key or exposed schema is needed.
//   The standalone repo's local-file backend was dropped along with its fake dev users.

type VersionFilter = { quizVersion: string; userId?: string };

export interface QuizBackend {
  /** Save a scored attempt. Storage creates the id. */
  saveAttempt(input: Omit<StoredAttempt, 'id'>): Promise<StoredAttempt>;
  /** One attempt by id, or null if there's no such attempt. */
  getAttempt(id: string): Promise<StoredAttempt | null>;
  /** Attempts for a version, optionally just one user's. */
  listAttempts(filter: VersionFilter): Promise<StoredAttempt[]>;
  /** "Opened the quiz". Idempotent: keeps the FIRST start per user + version. */
  recordStart(start: QuizOpenEvent): Promise<void>;
  listStarts(filter: VersionFilter): Promise<QuizOpenEvent[]>;
  /** Everyone who must complete the quiz (the report uses it to find "not started"). */
  listStaff(): Promise<User[]>;
}

// ═════════════════════════════════════════════════════════════════════════════
// Connection
// ═════════════════════════════════════════════════════════════════════════════

declare global {
  // eslint-disable-next-line no-var
  var __quizPool: Pool | undefined;
}

/**
 * One small pool for the process. Staging runs through the session pooler at pool_size 15,
 * shared with Payload and the Audit Hub, so this stays at 2. Kept on `global` so dev hot reloads
 * don't leak a pool per edit.
 */
function pool(): Pool {
  if (!global.__quizPool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('POSTGRES_URL is not set: the security quiz cannot reach the database.');
    global.__quizPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return global.__quizPool;
}

/** Every table is schema-qualified: a SET search_path on a pooled connection would leak. */
async function query<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(text, values)).rows;
}

// ═════════════════════════════════════════════════════════════════════════════
// Rows
// ═════════════════════════════════════════════════════════════════════════════

/** A row of cybersecurity_quiz.attempts as pg returns it (snake_case, timestamptz → Date). */
interface AttemptRow {
  id: string;
  user_id: string;
  quiz_version: string;
  started_at: Date;
  completed_at: Date | null;
  answers: Record<string, string[]>;
  correct_count: number;
  total: number;
  score: string; // numeric comes back as a string from pg
  passed: boolean;
  per_question: StoredAttempt['perQuestion'];
}

/** Database row (snake_case) → app type (camelCase, ISO strings). */
function fromRow(r: AttemptRow): StoredAttempt {
  return {
    id: r.id,
    userId: r.user_id,
    quizVersion: r.quiz_version,
    startedAt: r.started_at.toISOString(),
    ...(r.completed_at ? { completedAt: r.completed_at.toISOString() } : {}),
    answers: r.answers,
    correctCount: r.correct_count,
    total: r.total,
    score: Number(r.score),
    passed: r.passed,
    perQuestion: r.per_question,
  };
}

const ATTEMPT_COLUMNS =
  'id, user_id, quiz_version, started_at, completed_at, answers, correct_count, total, score, passed, per_question';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ═════════════════════════════════════════════════════════════════════════════
// Postgres
// ═════════════════════════════════════════════════════════════════════════════

class PgBackend implements QuizBackend {
  async saveAttempt(a: Omit<StoredAttempt, 'id'>) {
    // jsonb parameters are passed as JSON text: pg would send a JS array as a Postgres array.
    const [row] = await query<AttemptRow>(
      `insert into cybersecurity_quiz.attempts
         (user_id, quiz_version, started_at, completed_at, answers, correct_count, total, score, passed, per_question)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb)
       returning ${ATTEMPT_COLUMNS}`,
      [
        a.userId,
        a.quizVersion,
        a.startedAt,
        a.completedAt ?? null,
        JSON.stringify(a.answers),
        a.correctCount,
        a.total,
        a.score,
        a.passed,
        JSON.stringify(a.perQuestion),
      ],
    );
    return fromRow(row);
  }

  async getAttempt(id: string) {
    // Attempt ids are uuids. Anything else can't exist, and Postgres would error on it.
    if (!UUID.test(id)) return null;
    const [row] = await query<AttemptRow>(`select ${ATTEMPT_COLUMNS} from cybersecurity_quiz.attempts where id = $1`, [id]);
    return row ? fromRow(row) : null;
  }

  async listAttempts({ quizVersion, userId }: VersionFilter) {
    const rows = await query<AttemptRow>(
      `select ${ATTEMPT_COLUMNS} from cybersecurity_quiz.attempts
       where quiz_version = $1 and ($2::varchar is null or user_id = $2)
       order by completed_at asc nulls last, id`,
      [quizVersion, userId ?? null],
    );
    return rows.map(fromRow);
  }

  async recordStart(start: QuizOpenEvent) {
    // The first start time is kept.
    await query(
      `insert into cybersecurity_quiz.quiz_starts (user_id, quiz_version, started_at)
       values ($1, $2, $3)
       on conflict (user_id, quiz_version) do nothing`,
      [start.userId, start.quizVersion, start.startedAt],
    );
  }

  async listStarts({ quizVersion, userId }: VersionFilter) {
    const rows = await query<{ user_id: string; quiz_version: string; started_at: Date }>(
      `select user_id, quiz_version, started_at from cybersecurity_quiz.quiz_starts
       where quiz_version = $1 and ($2::varchar is null or user_id = $2)
       order by user_id`,
      [quizVersion, userId ?? null],
    );
    return rows.map((r) => ({ userId: r.user_id, quizVersion: r.quiz_version, startedAt: r.started_at.toISOString() }));
  }

  /**
   * The roster: every intranet user with a department set (department is synced from their
   * Workspace OU at login), which leaves out service and stray accounts. Roles come from the
   * Payload users_roles table, whose foreign key is `parent_id`.
   */
  async listStaff() {
    const rows = await query<{ id: string; email: string; name: string | null; roles: string[] | null }>(
      `select u.id, u.email, u.name,
              array_agg(r.value::text) filter (where r.value is not null) as roles
       from public.users u
       left join public.users_roles r on r.parent_id = u.id
       where u.department_id is not null
       group by u.id, u.email, u.name
       order by u.id`,
    );
    const adminValues = parseAdminRoleValues(process.env.QUIZ_ADMIN_ROLE_VALUES);
    return rows.map((u) => ({
      id: u.id,
      name: u.name?.trim() || u.email,
      email: u.email,
      role: rolesFromIntranetRoles(u.roles ?? [], adminValues),
    }));
  }
}

let instance: QuizBackend | undefined;

/** The storage to use. Created on first use, so tests and builds don't need the env vars. */
export function getBackend(): QuizBackend {
  instance ??= new PgBackend();
  return instance;
}
