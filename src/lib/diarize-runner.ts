import { spawn } from "node:child_process";
import path from "node:path";
import {
  appendDiarizeLog,
  DiarizeTask,
  findDiarizeResult,
  taskToView,
  updateDiarizeTask,
} from "./diarize-tasks";
import { buildDiarizeHotwordFile } from "./diarize-hotwords";

export type DiarizeEvent =
  | { type: "task"; task: Awaited<ReturnType<typeof taskToView>> }
  | { type: "log"; stream: "stdout" | "stderr"; content: string }
  | { type: "done"; task: Awaited<ReturnType<typeof taskToView>> }
  | { type: "error"; message: string; task?: Awaited<ReturnType<typeof taskToView>> };

type Emit = (event: DiarizeEvent) => void;

/** Runs a diarize task and emits NDJSON-friendly progress events. */
export async function runDiarizeTask(task: DiarizeTask, emit: Emit): Promise<DiarizeTask> {
  let currentTask = await updateDiarizeTask(task.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: null,
  });
  emit({ type: "task", task: await taskToView(currentTask) });

  const runner = path.join(process.cwd(), "diarize.sh");
  const args = [
    currentTask.inputPath,
    "--engine", currentTask.engine,
    "--output-dir", currentTask.outputDir,
  ];
  if (currentTask.speakerCount !== null) {
    args.push("--speaker-count", String(currentTask.speakerCount));
  }

  const env = { ...process.env };
  try {
    const hotwords = await buildDiarizeHotwordFile(currentTask);
    env.FUNASR_HOTWORD = hotwords.path;
    appendDiarizeLog(
      currentTask,
      `==> Student Track 热词: ${hotwords.totalCount} 个，其中学生姓名 ${hotwords.studentNameCount} 个\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendDiarizeLog(currentTask, `==> Student Track 热词生成失败，继续转写: ${message}\n`);
  }

  return new Promise((resolve) => {
    const child = spawn(runner, args, {
      cwd: process.cwd(),
      env,
      shell: false,
    });

    child.stdout.on("data", (chunk: Buffer) => {
      const content = chunk.toString();
      appendDiarizeLog(currentTask, content);
      emit({ type: "log", stream: "stdout", content });
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const content = chunk.toString();
      appendDiarizeLog(currentTask, content);
      emit({ type: "log", stream: "stderr", content });
    });

    child.on("error", async (error) => {
      currentTask = await updateDiarizeTask(currentTask.id, {
        status: "failed",
        error: error.message,
        finishedAt: new Date().toISOString(),
      });
      emit({ type: "error", message: error.message, task: await taskToView(currentTask, true) });
      resolve(currentTask);
    });

    child.on("close", async (code) => {
      if (code === 0) {
        const result = await findDiarizeResult(currentTask);
        if (result.resultTextPath || result.resultJsonPath) {
          currentTask = await updateDiarizeTask(currentTask.id, {
            status: "succeeded",
            resultTextPath: result.resultTextPath,
            resultJsonPath: result.resultJsonPath,
            finishedAt: new Date().toISOString(),
          });
          emit({ type: "done", task: await taskToView(currentTask, true) });
          resolve(currentTask);
          return;
        }
        currentTask = await updateDiarizeTask(currentTask.id, {
          status: "failed",
          error: "转写脚本已结束，但未找到结果文件",
          finishedAt: new Date().toISOString(),
        });
        emit({ type: "error", message: currentTask.error || "未找到结果文件", task: await taskToView(currentTask, true) });
        resolve(currentTask);
        return;
      }

      currentTask = await updateDiarizeTask(currentTask.id, {
        status: "failed",
        error: `转写脚本退出，code=${code}`,
        finishedAt: new Date().toISOString(),
      });
      emit({ type: "error", message: currentTask.error || "转写失败", task: await taskToView(currentTask, true) });
      resolve(currentTask);
    });
  });
}
