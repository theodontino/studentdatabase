import type { FeedbackContextStudent } from "@/components/wecom/types";
import type { TeachingContext } from "@/features/teaching-context";
import type { AiWorkflowState } from "@/features/ai-workflow";
import type { DraftReviewResult, DraftStructuredResult, NameCorrection } from "@/lib/types";
import type { FeedbackReviewStatus } from "@/services/feedback-generation-service";

export interface FeedbackCard {
  id: string;
  name: string;
  labels: string[];
  feedback: string;
  draftFeedback?: string;
  reviewStatus?: FeedbackReviewStatus;
  reviewIssues?: string[];
}

export interface FeedbackContextResponse {
  className: string;
  total: number;
  students: FeedbackContextStudent[];
}

export interface BatchFeedbackHistoryState {
  kind: "batch";
  semesterId: string;
  sessionCode: string;
  className: string;
  students: FeedbackCard[];
  total: number;
}

export interface SingleFeedbackHistoryState {
  kind: "single";
  semesterId: string;
  className: string;
  studentId: string;
  sessionCode: string;
  days: number;
  feedback: string;
  draftFeedback?: string;
  reviewStatus?: FeedbackReviewStatus;
  reviewIssues?: string[];
}

export type FeedbackHistoryState = BatchFeedbackHistoryState | SingleFeedbackHistoryState;

export interface FeedbackWorkspaceState {
  activeStep?: FeedbackStep;
  context: TeachingContext;
  newSessionDate: string;
  rawText: string;
  parseStatus: string;
  streamContent: string;
  draftId: string;
  parsedResult: DraftStructuredResult | null;
  reviewResult: DraftReviewResult | null;
  corrections: NameCorrection[];
  confirmed: boolean;
  status: string;
  feedbackCards: FeedbackCard[];
  feedbackTotal: number;
  feedbackDone: number;
  feedbackDirty: boolean;
  forceRegenerate: boolean;
  singleStudentId: string;
  singleDays: number;
  singleFeedback: string;
  singleDraftFeedback?: string;
  singleReviewStatus?: FeedbackReviewStatus;
  singleReviewIssues?: string[];
  workflow?: AiWorkflowState;
}

export interface FeedbackStudentOption { id: string; name: string; class: string }

export type FeedbackStep = "prepare" | "extract" | "review" | "generate" | "export";
