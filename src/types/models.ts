export type ISODateTime = string;

export interface User {
  id: string;
  email: string;
  createdAt: ISODateTime;
}

export interface LearningMaterial {
  id: string;
  authorId: string;
  subject: string;
  title: string;
  content: string;
  /** Server paths or URLs for images attached to the saved material. */
  imagePaths: string[];
  isPublic: boolean;
  /** Present in material-management APIs; older saved mock data is migrated on read. */
  revision?: number;
  imageIds?: string[];
}

export interface SummaryTerm {
  term: string;
  definition: string;
}

export interface SummarySection {
  title: string;
  content: string;
  bulletPoints?: string[];
}

/** Structured presentation data can be returned alongside the raw summary text. */
export interface StructuredSummaryContent {
  coreConcepts: string[];
  keyTerms: SummaryTerm[];
  sections: SummarySection[];
}

export interface Summary {
  id: string;
  materialId: string;
  content: string;
  modelInfo: string;
  createdAt: ISODateTime;
  structuredContent?: StructuredSummaryContent;
}

export const QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'SHORT_ANSWER',
  'OX',
  'CONCEPT_CHECK',
  'CONCEPT_COMPARISON',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionSource = 'AI' | 'USER';

export interface QuestionChoice {
  id: string;
  questionId: string;
  content: string;
}

export interface Question {
  id: string;
  authorId: string;
  materialId: string;
  type: QuestionType;
  content: string;
  answer: string;
  explanation: string;
  source: QuestionSource;
  choices?: QuestionChoice[];
}

/** Use this type in the solve screen before the answer has been submitted. */
export type QuestionPrompt = Omit<Question, 'answer' | 'explanation'>;

export interface StudyRecord {
  id: string;
  userId: string;
  questionId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  solvedTime: ISODateTime;
}

export type AsyncJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

/** Accepted response for long-running summary and question-generation requests. */
export interface AsyncJobAccepted {
  jobId: string;
  status: Extract<AsyncJobStatus, 'QUEUED' | 'PROCESSING'>;
  pollAfterMs?: number;
}

export interface AsyncJob<T> {
  jobId: string;
  status: AsyncJobStatus;
  pollAfterMs?: number;
  result?: T;
  error?: {
    code?: string;
    message: string;
  };
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
}
