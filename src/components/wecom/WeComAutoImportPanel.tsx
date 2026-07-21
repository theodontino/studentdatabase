"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ConfirmDialog, StatusBanner } from "@/components/ui";
import type { WeComImportResult } from "./types";

interface ProgressEvent {
  type: "progress";
  progress: number;
  message: string;
  detail?: string;
}

interface CompleteEvent {
  type: "complete";
  result: WeComImportResult;
  conversationCount: number;
  messageCount: number;
  batchCount: number;
  attentionBatchCount: number;
}

interface CancelledEvent {
  type: "cancelled";
  runId: string;
  rolledBack: boolean;
}

interface StatusResponse {
  active: boolean;
  run: null | {
    id: string;
    status: string;
    messageCount: number;
    batchCount: number;
    communicationCount: number;
    receiptCounts: Record<string, number>;
    progress: number;
    cancelRequestedAt: string | null;
    cancelMode: string | null;
  };
}

interface WeComAutoImportPanelProps {
  onApplied?: (result: WeComImportResult) => void;
}

export default function WeComAutoImportPanel({ onApplied }: WeComAutoImportPanelProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [stopMode, setStopMode] = useState<"stop" | "stop_and_rollback" | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState<CompleteEvent | null>(null);
  const [remote, setRemote] = useState<StatusResponse | null>(null);
  const [controlBusy, setControlBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/wecom/auto-import", { cache: "no-store" });
      if (response.ok) setRemote(await response.json() as StatusResponse);
    } catch {
      // The streaming request remains authoritative while a short status poll fails.
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), 2_000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  async function startImport() {
    setConfirmationOpen(false);
    setRunning(true);
    setProgress(1);
    setMessage("正在启动…");
    setDetail("");
    setError("");
    setComplete(null);

    try {
      const response = await fetch("/api/wecom/auto-import", { method: "POST" });
      if (!response.ok || !response.body) throw new Error("无法启动企微一键导入");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ProgressEvent | CompleteEvent | CancelledEvent | { type: "error"; message: string };
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "progress") {
            setProgress(event.progress);
            setMessage(event.message);
            setDetail(event.detail || "");
          } else if (event.type === "complete") {
            setComplete(event);
            onApplied?.(event.result);
          } else {
            setMessage(event.rolledBack ? "本次导入已停止并回滚" : "本次导入已停止");
            setDetail("");
          }
        }
        if (done) break;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "企微一键导入失败");
    } finally {
      setRunning(false);
      await loadStatus();
    }
  }

  async function requestStop() {
    if (!stopMode) return;
    setControlBusy(true);
    setError("");
    try {
      const response = await fetch("/api/wecom/auto-import", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: stopMode }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "停止企微导入失败");
      setMessage(stopMode === "stop_and_rollback" ? "已请求停止，安全点到达后将自动回滚…" : "已请求停止，正在等待当前调用结束…");
      setStopMode(null);
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "停止企微导入失败");
    } finally {
      setControlBusy(false);
    }
  }

  const active = running || Boolean(remote?.active);
  const visibleProgress = running ? progress : remote?.active && remote.run ? remote.run.progress : progress;
  const visibleMessage = running
    ? message
    : remote?.active
      ? remote.run?.cancelRequestedAt ? "正在安全停止企微导入…" : "企微导入正在后台运行…"
      : message;
  const remoteDetail = remote?.active && remote.run
    ? `已写入 ${remote.run.communicationCount} 条 · 待处理 ${remote.run.receiptCounts.pending ?? 0} 条 · 待复核 ${remote.run.receiptCounts.needs_review ?? 0} 条`
    : "";
  const visibleDetail = running ? detail : remoteDetail || detail;

  return (
    <>
      <section className="min-w-0 rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h3 className="font-semibold text-gray-800">一键同步并导入</h3>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              自动拉取企微聊天，只把未处理的新消息交给 LLM；每批独立写入并记录可回滚变更。
            </p>
          </div>
          <Button onClick={() => setConfirmationOpen(true)} disabled={active}>
            {active ? "处理中…" : "一键同步并导入"}
          </Button>
        </div>

        {(active || visibleProgress > 0) && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-700">{visibleMessage}</span>
              <span className="shrink-0 tabular-nums text-gray-500">{visibleProgress}%</span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-blue-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={visibleProgress}
              aria-label={visibleMessage || "企微导入进度"}
            >
              <div className="h-full rounded-full bg-blue-600 transition-[width] duration-500" style={{ width: `${visibleProgress}%` }} />
            </div>
            {visibleDetail && <p className="text-xs text-gray-500">{visibleDetail}</p>}
            {active && <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" uiSize="sm" disabled={controlBusy} onClick={() => setStopMode("stop")}>停止处理</Button>
              <Button variant="warning" uiSize="sm" disabled={controlBusy} onClick={() => setStopMode("stop_and_rollback")}>停止并回滚本次</Button>
            </div>}
          </div>
        )}

        {error && <StatusBanner tone="danger">{error}；已成功批次不会重复调用 LLM，可从失败批次继续。</StatusBanner>}
        {complete && (
          <StatusBanner tone={complete.attentionBatchCount > 0 ? "warning" : "success"}>
            处理 {complete.conversationCount} 个会话、{complete.messageCount} 条新消息，写入 {complete.result.createdCount} 条家校沟通，
            新增 {complete.result.createdLabelCount} 个内部关注标签。
            {complete.attentionBatchCount > 0 && ` ${complete.attentionBatchCount} 个交流段已暂停或等待人工处理，请到“维护与日志”查看。`}
          </StatusBanner>
        )}
      </section>

      <ConfirmDialog
        open={confirmationOpen}
        title="一键同步并导入企微记录"
        description="该操作会自动操作企微窗口，可能改变未读状态；筛选后的聊天内容会发送给当前配置的 LLM。请确保 Mac 已解锁，处理期间不要操作企微。"
        confirmLabel="开始处理"
        busy={running}
        onConfirm={() => void startImport()}
        onClose={() => setConfirmationOpen(false)}
      />
      <ConfirmDialog
        open={stopMode !== null}
        title={stopMode === "stop_and_rollback" ? "停止并回滚本次导入" : "停止本次导入"}
        description={stopMode === "stop_and_rollback"
          ? "系统会等待当前模型调用到达安全点，停止继续写入，建立安全备份后只撤销本次运行产生的增量。"
          : "系统会等待当前模型调用到达安全点后停止；已经成功写入的批次会保留。"}
        confirmLabel={stopMode === "stop_and_rollback" ? "停止并回滚" : "停止处理"}
        warning={stopMode === "stop_and_rollback"}
        busy={controlBusy}
        onConfirm={() => void requestStop()}
        onClose={() => setStopMode(null)}
      />
    </>
  );
}
