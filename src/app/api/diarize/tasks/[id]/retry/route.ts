import { NextResponse } from "next/server";
import { createRetryDiarizeTask, readDiarizeTask, taskToView } from "@/lib/diarize-tasks";
import { runDiarizeTask } from "@/lib/diarize-runner";

export const runtime = "nodejs";

function eventLine(event: unknown) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const source = await readDiarizeTask(id);
    const task = await createRetryDiarizeTask(source);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: unknown) => controller.enqueue(encoder.encode(eventLine(event)));
        try {
          emit({ type: "created", task: await taskToView(task) });
          await runDiarizeTask(task, emit);
        } catch (error: any) {
          emit({ type: "error", message: error.message || "重试任务失败" });
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
    return NextResponse.json({ error: error.message || "重试任务失败" }, { status: 400 });
  }
}
