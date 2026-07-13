"use client";

import { useMemo, useState } from "react";
import SemesterPicker from "@/components/SemesterPicker";
import WorkHistoryButton from "@/components/WorkHistoryButton";
import { Button, Card, PageHeader, StatusBanner } from "@/components/ui";
import { saveWorkHistory } from "@/lib/history";
import { requestJson } from "@/lib/api-client";
import { isDailyHistoryState, type DailyHistoryState } from "./history-adapters";
import { isTeachingContext, teachingContextWorkspaceKey, useTeachingContext, type TeachingContext } from "@/features/teaching-context";
import { useSessionWorkspace } from "@/lib/use-session-workspace";

interface DailyReportSessionState { context: TeachingContext; report: string; }
function isDailyReportSessionState(value: unknown): value is DailyReportSessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<DailyReportSessionState>;
  return isTeachingContext(state.context) && typeof state.report === "string";
}

export default function DailyReportWorkspace() {
  const { context, hydrated: contextHydrated, setContext, setSemesterId, setClassName, setSessionCode } = useTeachingContext();
  const { semesterId, className, sessionCode } = context;
  const [report, setReport] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const workspaceValue = useMemo<DailyReportSessionState>(() => ({ context, report }), [context, report]);
  useSessionWorkspace({ key: teachingContextWorkspaceKey("daily-report", context), value: workspaceValue, validate: isDailyReportSessionState, enabled: contextHydrated, restore: (saved) => { setReport(saved?.report ?? ""); setError(""); } });
  async function generate() { if (!sessionCode) return; setLoading(true); setError(""); try { const result = await requestJson<{ report: string }>("/api/report/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionCode }) }); setReport(result.report); await saveWorkHistory("report", `${className} ${sessionCode} 班级日报`, { kind: "daily", semesterId, className, sessionCode, report: result.report } satisfies DailyHistoryState, sessionCode); } catch (reason) { setError(reason instanceof Error ? reason.message : "生成日报失败"); } finally { setLoading(false); } }
  function restore(state: DailyHistoryState) { setContext({ semesterId: state.semesterId, className: state.className, sessionCode: state.sessionCode }); setReport(state.report); setError(""); }
  return <div className="mx-auto max-w-5xl"><PageHeader title="班级日报" description="按课次生成班级层面的课堂摘要；学生家校反馈已移至课后反馈工作台。" actions={<WorkHistoryButton<DailyHistoryState> module="report" accept={isDailyHistoryState} onRestore={restore} />} /><Card className="p-6"><SemesterPicker semesterId={semesterId} onSemesterChange={setSemesterId} className={className} onClassChange={setClassName} sessionCode={sessionCode} onSessionChange={setSessionCode} />{error && <div className="mt-4"><StatusBanner tone="danger">{error}</StatusBanner></div>}<div className="mt-4"><Button disabled={!sessionCode || loading} onClick={generate}>{loading ? "生成中…" : "生成班级日报"}</Button></div>{report && <div className="mt-5 whitespace-pre-wrap rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-gray-700">{report}</div>}</Card></div>;
}
