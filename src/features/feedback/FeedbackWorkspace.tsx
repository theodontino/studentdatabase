"use client";

import WorkHistoryButton from "@/components/WorkHistoryButton";
import { Button, Drawer, PageHeader, StatusBanner } from "@/components/ui";
import type { InputHistoryState } from "@/features/entry";
import { useState } from "react";
import { FeedbackWorkflow } from "./FeedbackWorkflow";
import { isInputHistoryState, isLegacyFeedbackState } from "./history-adapters";
import { SingleFeedbackPanel } from "./SingleFeedbackPanel";
import type { FeedbackHistoryState, FeedbackStep } from "./types";
import { useFeedbackWorkspace } from "./useFeedbackWorkspace";

const FEEDBACK_HISTORY_MODULES = ["feedback", "report", "input"] as const;
type WorkbenchHistoryState = FeedbackHistoryState | InputHistoryState;
function isWorkbenchHistoryState(value: unknown): value is WorkbenchHistoryState { return isLegacyFeedbackState(value) || isInputHistoryState(value); }

export default function FeedbackWorkspace({ initialStep }: { initialStep?: FeedbackStep }) {
  const workspace = useFeedbackWorkspace(initialStep);
  const [singleOpen, setSingleOpen] = useState(false);
  return (
    <main className="feedback-workspace">
      <PageHeader title="课后工作台" description="准备上下文、录入课堂记录、复核并生成家长反馈。" actions={<><Button variant="secondary" onClick={() => setSingleOpen(true)}>单人反馈</Button><WorkHistoryButton<WorkbenchHistoryState> modules={FEEDBACK_HISTORY_MODULES} accept={isWorkbenchHistoryState} onRestore={workspace.restoreHistory} /></>} />
      {workspace.error && <StatusBanner tone="danger">{workspace.error}</StatusBanner>}
      {workspace.status && <StatusBanner tone="success">{workspace.status}</StatusBanner>}
      {workspace.legacyDraftAvailable && <StatusBanner tone="warning">另有一份旧“课堂录入”草稿仍保留在当前标签页。<Button variant="ghost" uiSize="sm" onClick={workspace.restoreLegacyDraft}>载入旧草稿</Button></StatusBanner>}
      <FeedbackWorkflow workspace={workspace} />
      <Drawer open={singleOpen} title="单人反馈" size="wide" onClose={() => setSingleOpen(false)}><div className="feedback-single-drawer"><SingleFeedbackPanel workspace={workspace} /></div></Drawer>
    </main>
  );
}
