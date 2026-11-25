import type { PrivateSimulationQuestion, SimulationQuestion, SimulationReview } from './simulation.types';

/** Choice-based question types. Interactive simulations have their own type: see simulation.types.ts */
export type QuestionTypes = 'multi' | 'single' | 'truefalse';

export interface Option {
    id: string;         // 'a', 'b', 'c', 'd'
    label: string;      // 'Option A', 'Option B', etc.
}

/** What the browser receives: no answers */
export interface PublicQuestion {
    id: string;         // 'q1', 'q2', etc.
    topic: Topic;        // 'passwords', 'phishing', etc.
    type: QuestionTypes; // 'multi', 'single', 'truefalse'
    prompt: string;     // The question text
    options: Option[];  // The possible answers
    imageUrl?: string;     // Optional image URL
}

/**Server only: includes answers + teaching notes */
export interface PrivateQuestion extends PublicQuestion {
    correct: string[];  // option ids
    explanation: string;      // Additional information for instructors
    policyRef?: string;  // Optional reference to a policy or guideline
}

export type Topic = 'phishing' | 'passwords_mfa' | 'data_classifications' | 'payment_data' | 'ai_tools' | 'devices' | 'networks' | 'incidents' | 'software';

export interface Quiz {
    version: string;               // Version of the quiz
    title: string;                 // Title of the quiz
    passMark: number;           // Minimum score to pass
    questions: PrivateQuestion[];  // Server only: each question carries its own correct answers
    simulations?: PrivateSimulationQuestion[]; // Server only: interactive scenarios. Each one counts as one question in the score
    /**
     * Optional: each attempt gets a random SELECTION from the bank instead of every item
     * (see draw.ts). Omitted = everyone answers every item, in the order written.
     */
    draw?: DrawRule;
}

/** How many of each kind one attempt gets, e.g. { questions: 10, simulations: 5 } = 15 items. */
export interface DrawRule {
    questions: number;    // choice questions per attempt (spread across topics)
    simulations: number;  // interactive scenarios per attempt
}

export interface AttemptResult {
    attemptId: string;            // Unique identifier for the attempt
    quizVersion: string;          // Version of the quiz attempted
    score: number;                // Score achieved in the attempt
    correctCount: number;          // Number of correct answers
    total: number;                 // Total number of questions
    passed: boolean;              // Whether the attempt passed or failed
    completedAt: string;             // Timestamp of when the attempt was completed
    feedback: Array<{
        questionId: string;      // ID of the question
        correct: boolean;        // Whether the answer was correct
        explanation?: string;    // Optional explanation for the answer
        policyRef?: string;     // Optional reference to a policy or guideline
        /** Scenarios only: real red flags spotted / real flags on the screens seen. */
        flags?: { found: number; total: number };
        /** Scenarios only: what happened and why (each choice, each red flag, false alarms). */
        review?: SimulationReview;
    }>;
}

export type CompletionStatus = 'not_started' | 'in_progress' | 'completed' | 'failed';

export type MyStatus = {
    quizVersion: string;          // Version of the quiz
    status: CompletionStatus;     // Where the user is up to: not_started, in_progress, completed, failed
    bestScore: number;           // Best score achieved so far
    completedAt?: string;             // Timestamp of when the quiz was last completed
    lastAttempt?: AttemptResult;  // Optional details of the last attempt
    attempts: number;                // Total number of attempts made
};

export const TOPIC_LABELS: Record<Topic, string> = {
  phishing: 'Phishing & scams',
  passwords_mfa: 'Passwords & MFA',
  data_classifications: 'Handling customer data',
  payment_data: 'Payment data',
  ai_tools: 'AI tools',
  devices: 'Devices & physical security',
  networks: 'Networks & remote work',
  incidents: 'Reporting incidents',
  software: 'Software',
};

/** Display letter for an option, from its position: 0->A */
export const optionLetter = (index: number) => String.fromCharCode(65 + index);// 65 is the char code for 'A'

/**
 * What the browser receives. BOTH private lists are omitted and replaced with their public versions.
 * (If only 'questions' were omitted, `simulations` would keep its private type, answer key included.)
 */
export interface PublicQuiz extends Omit<Quiz, 'questions' | 'simulations'> {
    questions: PublicQuestion[];
    simulations?: SimulationQuestion[];
    /** Item ids (questions + scenarios mixed) in the order to show them. Set for a drawn quiz. */
    order?: string[];
}

export interface StoredAttempt {
    id: string;                    // Unique identifier for the attempt
    quizVersion: string;          // Version of the quiz attempted
    userId: string;                // ID of the user who made the attempt
    startedAt: string;             // Timestamp of when the attempt was started
    completedAt?: string;          // Optional timestamp of when the attempt was completed
    answers: Record<string, string[]>; // Mapping of question IDs to selected option IDs
    correctCount: number;          // Number of questions answered correctly
    total: number;                 // Total number of questions
    score: number;                // Score achieved in the attempt
    passed: boolean;              // Whether the attempt passed or failed
    perQuestion: Array<{
        questionId: string;      // ID of the question
        correct: boolean;        // Whether the answer was correct
    }>;
}

/**
 * Body of POST /api/quiz/submit: what the browser sends when the user clicks Submit.
 * Never includes userId/email: identity always comes from the SSO session on the server.
 * Validated at runtime by SubmitAttemptRequestSchema in schema.ts.
 */
export interface SubmitAttemptRequest {
    quizVersion: string;                // The version the user was answering; must match the live quiz
    startedAt: string;                  // ISO timestamp from when they began
    answers: Record<string, string[]>;  // questionId → option ids (choice) or action + hotspot ids (simulation)
}

/** Body of POST /api/quiz/start: "I've opened the quiz". Validated by StartRequestSchema. */
export interface StartQuizRequest {
    quizVersion: string;
}

/**Recorded when somebody opens the quiz */
export interface QuizOpenEvent {
    userId: string;                // ID of the user who opened the quiz
    quizVersion: string;          // Version of the quiz opened
    startedAt: string;             // Timestamp of when the quiz was started
}

export type Role = 'user' | 'admin';

export interface User {
    id: string;                    // Unique identifier for the user
    name: string;                  // User's full name
    email: string;                 // User's email address
    role: Role[];                    // User's role in the system
}

export interface ReportRow extends MyStatus {
    userId: string;                // Unique identifier for the user
    name: string;                  // User's full name
    email: string;                 // User's email address
    lastAttemptAt?: string;        // Optional timestamp of the last attempt
}

export interface Report {
    quizVersion: string;
    quizTitle: string;
    generatedAt: string;
    summary: {total: number; done: number; failed: number; inProgress: number; notStarted: number};
    rows: ReportRow[];
}

