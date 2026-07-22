#!/bin/bash
set -euo pipefail

# Student Track project entry for audio diarization/transcription.
#
# This wrapper intentionally delegates to the installed diarize toolkit instead
# of copying credentials, Python runners, or the virtualenv into the app repo.
# The future Web UI can call this stable project-level entry and persist task
# metadata under data/diarize/ without depending on the external tool layout.

TOOL_DIR="${STUDENT_TRACK_DIARIZE_TOOL_DIR:-${CHEM_TRACK_DIARIZE_TOOL_DIR:-$HOME/tools/funasr-diarize}}"
STUDENT_TRACK_LOCAL_MODEL="${STUDENT_TRACK_LOCAL_MODEL:-${CHEM_TRACK_LOCAL_MODEL:-iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch}}"
ENGINE="auto"
AUDIO_FILE=""
OUTPUT_DIR=""
SPEAKER_COUNT=""

usage() {
  echo "用法: ./diarize.sh <audio_file> [--engine auto|local|tingwu] [--output-dir DIR] [--speaker-count N]"
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --engine)
      if [ $# -lt 2 ] || [[ "$2" == -* ]]; then
        echo "错误: --engine 后需要 auto、local 或 tingwu"
        exit 1
      fi
      ENGINE="$2"
      shift 2
      ;;
    --output-dir)
      if [ $# -lt 2 ] || [[ "$2" == -* ]]; then
        echo "错误: --output-dir 后需要一个目录"
        exit 1
      fi
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --speaker-count)
      if [ $# -lt 2 ] || [[ "$2" == -* ]]; then
        echo "错误: --speaker-count 后需要一个数字"
        exit 1
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "错误: --speaker-count 必须是非负整数"
        exit 1
      fi
      SPEAKER_COUNT="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    -*)
      echo "未知选项: $1"
      exit 1
      ;;
    *)
      if [ -n "$AUDIO_FILE" ]; then
        echo "错误: 只能指定一个音频文件"
        exit 1
      fi
      AUDIO_FILE="$1"
      shift
      ;;
  esac
done

if [ -z "$AUDIO_FILE" ]; then
  echo "错误: 缺少音频文件"
  usage
  exit 1
fi

if [ ! -f "$AUDIO_FILE" ]; then
  echo "错误: 音频文件不存在: $AUDIO_FILE"
  exit 1
fi

case "$ENGINE" in
  auto) RUNNER="$TOOL_DIR/diarize_auto.sh" ;;
  local) RUNNER="$TOOL_DIR/diarize.sh" ;;
  tingwu) RUNNER="$TOOL_DIR/diarize_tingwu.sh" ;;
  *)
    echo "错误: --engine 只能是 auto、local 或 tingwu"
    exit 1
    ;;
esac

if [ "$ENGINE" = "auto" ] || [ "$ENGINE" = "local" ]; then
  export FUNASR_MODEL="${FUNASR_MODEL:-$STUDENT_TRACK_LOCAL_MODEL}"
  export FUNASR_TRANSCRIPT_ONLY="${FUNASR_TRANSCRIPT_ONLY:-1}"
fi

if [ ! -x "$RUNNER" ]; then
  echo "错误: 找不到可执行转写脚本: $RUNNER"
  echo "可用 STUDENT_TRACK_DIARIZE_TOOL_DIR 指向工具目录"
  exit 1
fi

ARGS=("$AUDIO_FILE")
if [ -n "$OUTPUT_DIR" ]; then
  ARGS+=("--output-dir" "$OUTPUT_DIR")
fi
if [ -n "$SPEAKER_COUNT" ]; then
  ARGS+=("--speaker-count" "$SPEAKER_COUNT")
fi

exec "$RUNNER" "${ARGS[@]}"
