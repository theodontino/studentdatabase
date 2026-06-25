import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import {
  createDiarizeTask,
  isDiarizeEngine,
  listDiarizeTasks,
  taskToView,
} from "@/lib/diarize-tasks";
import { runDiarizeTask } from "@/lib/diarize-runner";

export const runtime = "nodejs";

function parseSpeakerCount(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error("说话人数必须是非负整数");
  return number;
}

function eventLine(event: unknown) {
  return `${JSON.stringify(event)}\n`;
}

export async function GET() {
  const tasks = await listDiarizeTasks();
  const views = await Promise.all(tasks.map((task) => taskToView(task)));
  return NextResponse.json({ tasks: views });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const engine = formData.get("engine") || "auto";
    const speakerCount = parseSpeakerCount(formData.get("speakerCount"));

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "请上传音频文件" }, { status: 400 });
    }
    if (!isDiarizeEngine(engine)) {
      return NextResponse.json({ error: "无效的转写引擎" }, { status: 400 });
    }

    const task = await createDiarizeTask({
      title: audio.name,
      engine,
      speakerCount,
      inputFileName: audio.name,
    });
    await fs.promises.writeFile(task.inputPath, Buffer.from(await audio.arrayBuffer()));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: unknown) => controller.enqueue(encoder.encode(eventLine(event)));
        try {
          emit({ type: "created", task: await taskToView(task) });
          await runDiarizeTask(task, emit);
        } catch (error: any) {
          emit({ type: "error", message: error.message || "转写任务失败" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "创建转写任务失败" }, { status: 400 });
  }
}
