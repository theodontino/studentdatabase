import { Button, EmptyState, StatusBanner, Textarea } from "@/components/ui";
import {
  DIARIZE_STATUS_CLASS,
  DIARIZE_STATUS_LABEL,
  formatDiarizeTime,
  type DiarizeTask,
} from "./diarize-types";

export function DiarizeTaskDetail({ task, onCopy, onDownload, onSendToFeedback }: {
  task: DiarizeTask;
  onCopy: () => void;
  onDownload: () => void;
  onSendToFeedback: () => void;
}) {
  return (
    <section className="min-w-0 bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0"><h3 className="truncate font-semibold text-gray-800" title={task.title}>{task.title}</h3><div className="text-xs text-gray-500 mt-1">{task.engine} / 创建于 {formatDiarizeTime(task.createdAt)}</div></div>
        <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${DIARIZE_STATUS_CLASS[task.status]}`}>{DIARIZE_STATUS_LABEL[task.status]}</span>
      </div>
      {task.error && <div className="mb-4"><StatusBanner tone="danger">{task.error}</StatusBanner></div>}
      {task.resultText ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onCopy}>复制文字稿</Button>
            <Button variant="secondary" onClick={onDownload}>下载 TXT</Button>
            <Button onClick={onSendToFeedback}>送入课后工作台</Button>
          </div>
          <Textarea readOnly value={task.resultText} className="h-80 font-mono bg-gray-50" aria-label="转写文字稿" />
        </div>
      ) : <EmptyState title="文字稿尚未生成" description="任务完成后会在这里显示文字稿。" />}
    </section>
  );
}

export function DiarizeRunLog({ logs }: { logs: string }) {
  return <section className="min-w-0 bg-gray-950 rounded-lg p-4"><div className="mb-2 text-xs font-medium text-gray-300">运行日志</div><pre className="h-56 max-w-full overflow-auto whitespace-pre-wrap break-all text-xs text-gray-100">{logs || "暂无日志"}</pre></section>;
}
