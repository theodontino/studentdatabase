"use client";

import { useReducer, type Dispatch } from "react";
import {
  aiWorkflowReducer,
  INITIAL_AI_WORKFLOW_STATE,
  type AiWorkflowAction,
  type AiWorkflowActivePhase,
  type AiWorkflowState,
} from "./workflow-machine";

export interface AiWorkflowController {
  state: AiWorkflowState;
  start: (operation: string, message?: string) => void;
  transition: (phase: AiWorkflowActivePhase | "completed", message?: string) => void;
  progress: (progress: number, message?: string) => void;
  fail: (error: string, retryPhase?: AiWorkflowActivePhase, message?: string) => void;
  cancel: (message?: string) => void;
  reset: () => void;
  restore: (saved: unknown) => void;
}

export function createAiWorkflowController(state: AiWorkflowState, dispatch: Dispatch<AiWorkflowAction>): AiWorkflowController {
  return {
    state,
    start(operation: string, message?: string) { dispatch({ type: "start", operation, message }); },
    transition(phase: AiWorkflowActivePhase | "completed", message?: string) { dispatch({ type: "transition", phase, message }); },
    progress(progress: number, message?: string) { dispatch({ type: "progress", progress, message }); },
    fail(error: string, retryPhase?: AiWorkflowActivePhase, message?: string) { dispatch({ type: "fail", error, retryPhase, message }); },
    cancel(message?: string) { dispatch({ type: "cancel", message }); },
    reset() { dispatch({ type: "reset" }); },
    restore(saved: unknown) { dispatch({ type: "restore", state: saved }); },
  };
}

export function useAiWorkflow(initialState: AiWorkflowState = INITIAL_AI_WORKFLOW_STATE) {
  const [state, dispatch] = useReducer(aiWorkflowReducer, initialState);
  return createAiWorkflowController(state, dispatch);
}
