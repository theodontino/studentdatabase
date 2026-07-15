"use client";

import { useEffect, useRef, useState } from "react";
import type { RecordingState } from "./diarize-types";

function preferredRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function recordingExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function formatRecordingDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function useAudioRecorder({ onRecorded, onError, onStatus }: {
  onRecorded: (file: File) => void;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
}) {
  const [state, setState] = useState<RecordingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const secondsRef = useRef(0);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => () => {
    stopTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function start() {
    if (state === "recording") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError("当前浏览器不支持现场录音");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      onError("当前浏览器不支持 MediaRecorder 录音");
      return;
    }
    onError("");
    onStatus("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size === 0) {
          onError("录音内容为空，请重试");
          setState("idle");
          return;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        onRecorded(new File([blob], `现场录音-${timestamp}.${recordingExtension(type)}`, { type }));
        setState("recorded");
        onStatus(`现场录音已就绪，时长 ${formatRecordingDuration(secondsRef.current)}。`);
      };
      setSeconds(0);
      secondsRef.current = 0;
      setState("recording");
      recorder.start(1000);
      timerRef.current = window.setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
    } catch (error: unknown) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setState("idle");
      onError(error instanceof DOMException && error.name === "NotAllowedError" ? "麦克风权限被拒绝" : error instanceof Error ? error.message : "无法开始录音");
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function discard() {
    if (state === "recording") stop();
    chunksRef.current = [];
    setState("idle");
    setSeconds(0);
    secondsRef.current = 0;
    onStatus("");
  }

  function selectFile() {
    setState("idle");
    setSeconds(0);
    secondsRef.current = 0;
  }

  return { state, seconds, start, stop, discard, selectFile };
}
