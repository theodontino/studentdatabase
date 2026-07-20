"use client";

import { Badge, Button, EmptyState, Section, StatusBanner, Textarea } from "@/components/ui";
import type { useFeedbackWorkspace } from "./useFeedbackWorkspace";

type Workspace = ReturnType<typeof useFeedbackWorkspace>;

const reviewLabels = {
  passed: { label: "AI 审核通过", tone: "success" as const },
  revised: { label: "AI 已修订", tone: "info" as const },
  needs_review: { label: "需要人工确认", tone: "warning" as const },
  edited: { label: "教师已修改", tone: "success" as const },
};

export function FeedbackGenerationPanel({ workspace, mode = "export" }: { workspace: Workspace; mode?: "generate" | "export" }) {
  return (
    <Section title={mode === "generate" ? "生成班级反馈" : "编辑与导出"} description={mode === "generate" ? "起草模型先生成初稿，审核模型再对照确定性背景逐条复核。" : "逐条检查和修改；待人工确认项处理完后才能导出。"} actions={<>{mode === "generate" && <Button onClick={() => void workspace.generate()} disabled={!workspace.canGenerate}>{workspace.generating ? `${workspace.feedbackPhase === "review" ? "审核" : "起草"}中 ${workspace.feedbackDone}/${workspace.feedbackTotal}` : "批量生成并审核"}</Button>}{mode === "export" && <><Button variant="secondary" onClick={() => workspace.setActiveStep("generate")}>重新生成</Button><Button onClick={() => void workspace.exportFeedback()} disabled={workspace.exporting || !workspace.feedbackCards.length || workspace.feedbackReviewBlockerCount > 0}>{workspace.exporting ? "导出中…" : "导出课后反馈表"}</Button></>}</>}>
      <div className="feedback-generation">
        {workspace.feedbackReviewBlockerCount > 0 && <StatusBanner tone="warning">有 {workspace.feedbackReviewBlockerCount} 条反馈需要人工确认；编辑对应文本后即可解除导出限制。</StatusBanner>}
        {!workspace.feedbackCards.length ? <EmptyState title={workspace.generating ? "正在生成反馈" : "尚未生成反馈"} description={workspace.generating ? `${workspace.feedbackPhase === "review" ? "审核" : "起草"} ${workspace.feedbackDone}/${workspace.feedbackTotal || "…"}，完成后会自动进入编辑与导出。` : "选择课次并生成后，每名学生的反馈会显示在这里。"} /> : workspace.feedbackCards.map((card) => {
          const context = workspace.contextByStudent.get(card.id);
          const labels = context?.labels.length ? context.labels : card.labels;
          const review = card.reviewStatus ? reviewLabels[card.reviewStatus] : null;
          return <article key={card.id} className="feedback-card">
            <header><strong>{card.name}</strong><div>{review && <Badge tone={review.tone}>{review.label}</Badge>}{labels.map((label) => <Badge key={label} tone="info">{label}</Badge>)}</div></header>
            {context && <p className="feedback-card__context">{context.preview.today.slice(0, 2).join("；")}{context.preview.communications.length ? `；${context.preview.communications[0]}` : ""}</p>}
            {card.reviewIssues?.length ? <ul className="feedback-card__review-issues">{card.reviewIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
            {card.draftFeedback && card.draftFeedback !== card.feedback && <details className="feedback-card__draft"><summary>查看起草稿</summary><p>{card.draftFeedback}</p></details>}
            <Textarea aria-label={`${card.name}反馈`} value={card.feedback} onChange={(event) => workspace.updateFeedback(card.id, event.target.value)} rows={5} />
            <footer><Button variant="ghost" uiSize="sm" onClick={() => void navigator.clipboard?.writeText(card.feedback)}>复制</Button><Button variant="secondary" uiSize="sm" onClick={() => void workspace.regenerateOne(card.id)} disabled={workspace.regeneratingId === card.id}>{workspace.regeneratingId === card.id ? "生成中…" : "单独重写"}</Button></footer>
          </article>;
        })}
      </div>
    </Section>
  );
}
