import { Button, StatusBanner } from "@/components/ui";
import {
  DIARIZE_ENGINES,
  type DiarizeEngine,
  type DiarizeTask,
  type RecordingState,
} from "./diarize-types";
import { formatRecordingDuration } from "./use-audio-recorder";

export function DiarizeTaskComposer({
  audioFile,
  engine,
  busy,
  activeTask,
  recordingState,
  recordingSeconds,
  status,
  error,
  onAudioFileChange,
  onEngineChange,
  onStartRecording,
  onStopRecording,
  onDiscardRecording,
  onStartTask,
  onRetryTask,
}: {
  audioFile: File | null;
  engine: DiarizeEngine;
  busy: boolean;
  activeTask: DiarizeTask | null;
  recordingState: RecordingState;
  recordingSeconds: number;
  status: string;
  error: string;
  onAudioFileChange: (file: File | null) => void;
  onEngineChange: (engine: DiarizeEngine) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onDiscardRecording: () => void;
  onStartTask: () => void;
  onRetryTask: (taskId: string) => void;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block min-w-0">
          <span className="text-sm font-medium text-gray-700">音频文件</span>
          <input
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.flac,.ogg,.opus"
            onChange={(event) => onAudioFileChange(event.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {audioFile && <div className="mt-2 text-xs text-gray-500 truncate" title={audioFile.name}>当前：{audioFile.name}</div>}
        </label>

        <div>
          <div className="text-sm font-medium text-gray-700">现场录音</div>
          <div className="mt-1 flex items-center gap-2">
            {recordingState === "recording"
              ? <Button variant="danger" onClick={onStopRecording}>停止录音</Button>
              : <Button variant="secondary" onClick={onStartRecording} disabled={busy}>开始录音</Button>}
            {recordingState !== "idle" && <Button variant="ghost" onClick={onDiscardRecording} disabled={busy}>清除</Button>}
          </div>
          <div className={`mt-2 text-xs ${recordingState === "recording" ? "text-red-600" : "text-gray-500"}`}>
            {recordingState === "recording" ? `录音中 ${formatRecordingDuration(recordingSeconds)}` : recordingState === "recorded" ? `已录制 ${formatRecordingDuration(recordingSeconds)}` : "可直接录制当前课堂音频"}
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">转写方式</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2" role="radiogroup" aria-label="转写方式">
          {DIARIZE_ENGINES.map((item) => (
            <button
              type="button"
              role="radio"
              aria-checked={engine === item.value}
              key={item.value}
              onClick={() => onEngineChange(item.value)}
              className={`rounded-md border px-3 py-2 text-left ${engine === item.value ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
            >
              <div className="text-sm font-medium text-gray-800">{item.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{item.note}</div>
            </button>
          ))}
        </div>
      </div>

      {(engine === "tingwu" || engine === "auto") && (
        <StatusBanner tone="warning">{engine === "auto" ? "自动模式当前优先使用云端，音频可能上传；如需完全本地处理，请选择“本地”。" : "听悟模式会调用阿里云并上传音频到 OSS。"}</StatusBanner>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={onStartTask} disabled={busy || !audioFile}>{busy ? "处理中…" : "开始转写"}</Button>
        {activeTask?.status === "failed" && <Button variant="secondary" onClick={() => onRetryTask(activeTask.id)} disabled={busy}>重试</Button>}
      </div>
      {status && <StatusBanner tone="success">{status}</StatusBanner>}
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}
    </section>
  );
}
