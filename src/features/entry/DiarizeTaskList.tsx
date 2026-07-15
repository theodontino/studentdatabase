"use client";

import { Button, ConfirmDialog, EmptyState } from "@/components/ui";
import { useState } from "react";
import {
  DIARIZE_STATUS_CLASS,
  DIARIZE_STATUS_LABEL,
  formatDiarizeTime,
  type DiarizeTask,
} from "./diarize-types";

export function DiarizeTaskList({ tasks, busy, onRefresh, onOpen, onRetry, onDelete }: {
  tasks: DiarizeTask[];
  busy: boolean;
  onRefresh: () => void;
  onOpen: (taskId: string) => void;
  onRetry: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const [deleteTask, setDeleteTask] = useState<DiarizeTask | null>(null);
  return (
    <>
      <aside className="min-w-0 bg-white border border-gray-200 rounded-lg p-4 h-fit">
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-gray-800">任务列表</h3><Button variant="ghost" uiSize="sm" onClick={onRefresh}>刷新</Button></div>
        {tasks.length === 0 ? <EmptyState title="还没有转写任务" description="选择音频并开始转写后，任务会保留在这里。" /> : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <article key={task.id} className="min-w-0 rounded-md border border-gray-200 p-3">
                <button type="button" onClick={() => onOpen(task.id)} className="w-full min-w-0 text-left">
                  <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 font-medium text-sm text-gray-800 truncate">{task.title}</span><span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${DIARIZE_STATUS_CLASS[task.status]}`}>{DIARIZE_STATUS_LABEL[task.status]}</span></div>
                  <div className="mt-1 text-xs text-gray-500">{formatDiarizeTime(task.createdAt)}</div>
                </button>
                <div className="flex gap-2 mt-2"><Button variant="ghost" uiSize="sm" onClick={() => onOpen(task.id)}>查看</Button>{task.status === "failed" && <Button variant="ghost" uiSize="sm" onClick={() => onRetry(task.id)} disabled={busy}>重试</Button>}<Button variant="ghost" uiSize="sm" onClick={() => setDeleteTask(task)}>删除</Button></div>
              </article>
            ))}
          </div>
        )}
      </aside>
      <ConfirmDialog open={Boolean(deleteTask)} title="删除转写任务" description={deleteTask ? `确定删除“${deleteTask.title}”及其本地转写结果吗？此操作无法撤销。` : ""} confirmLabel="删除" danger onConfirm={() => { if (deleteTask) onDelete(deleteTask.id); setDeleteTask(null); }} onClose={() => setDeleteTask(null)} />
    </>
  );
}
