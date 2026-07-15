import {
  aiWorkflowReducer,
  INITIAL_AI_WORKFLOW_STATE,
  type AiWorkflowAction,
  type AiWorkflowState,
} from "@/features/ai-workflow";

export type EntryStep = "input" | "review";
export interface EntryState { step: EntryStep; workflow: AiWorkflowState; }
export type EntryAction = { type: "set-step"; step: EntryStep } | { type: "workflow"; action: AiWorkflowAction };
export const INITIAL_ENTRY_STATE: EntryState = { step: "input", workflow: INITIAL_AI_WORKFLOW_STATE };

export function entryReducer(state: EntryState, action: EntryAction): EntryState {
  if (action.type === "set-step") return state.step === action.step ? state : { ...state, step: action.step };
  return { ...state, workflow: aiWorkflowReducer(state.workflow, action.action) };
}
