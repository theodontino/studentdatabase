import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";

export type LLMTaskType = "wecom" | "classroom-parse" | "feedback" | "daily-report";
export type LLMCacheStatus = "active" | "succeeded" | "failed" | "interrupted";

interface LLMCacheManifest {
  id: string;
  taskType: LLMTaskType;
  title: string;
  status: LLMCacheStatus;
  startedAt: string;
  completedAt: string | null;
  callCount: number;
  warning: string | null;
}

interface LLMCacheContext {
  directory: string;
  manifest: LLMCacheManifest;
  nextCall: number;
  pendingWrites: Set<Promise<void>>;
  cacheWarning: boolean;
  incomplete: boolean;
}

export interface LLMCacheSummary extends LLMCacheManifest {
  sizeBytes: number;
}

export interface LLMCacheOverview {
  rootLabel: string;
  totalSizeBytes: number;
  maxSizeBytes: number;
  operations: LLMCacheSummary[];
}

const DEFAULT_CACHE_LIMIT_BYTES = 256 * 1024 * 1024;
const manifestName = "manifest.json";
const storage = new AsyncLocalStorage<LLMCacheContext>();
const activeDirectories = new Set<string>();

function cacheRoot() {
  return process.env.LLM_CACHE_ROOT || path.join(process.cwd(), "data", "llm-cache");
}

function cacheLimitBytes() {
  const configured = Number(process.env.LLM_CACHE_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CACHE_LIMIT_BYTES;
}

function shanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/^(authorization|cookie|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password)$/i.test(key)) {
      return [key, "[REDACTED]"];
    }
    return [key, sanitize(item)];
  }));
}

async function ensurePrivateDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => undefined);
}

async function writePrivateJson(filePath: string, value: unknown) {
  await ensurePrivateDirectory(path.dirname(filePath));
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(sanitize(value), null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
  await rename(temporary, filePath);
  await chmod(filePath, 0o600).catch(() => undefined);
}

async function readManifest(directory: string): Promise<LLMCacheManifest | null> {
  try {
    return JSON.parse(await readFile(path.join(directory, manifestName), "utf8")) as LLMCacheManifest;
  } catch {
    return null;
  }
}

async function directorySize(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) total += await directorySize(target);
    else total += (await stat(target).catch(() => null))?.size ?? 0;
  }
  return total;
}

async function operationDirectories() {
  const root = cacheRoot();
  const results: string[] = [];
  for (const day of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!day.isDirectory()) continue;
    const dayDirectory = path.join(root, day.name);
    for (const task of await readdir(dayDirectory, { withFileTypes: true }).catch(() => [])) {
      if (!task.isDirectory()) continue;
      const taskDirectory = path.join(dayDirectory, task.name);
      for (const operation of await readdir(taskDirectory, { withFileTypes: true }).catch(() => [])) {
        if (operation.isDirectory()) results.push(path.join(taskDirectory, operation.name));
      }
    }
  }
  return results;
}

async function markInterruptedOperations() {
  for (const directory of await operationDirectories()) {
    if (activeDirectories.has(directory)) continue;
    const manifest = await readManifest(directory);
    if (manifest?.status !== "active") continue;
    await writePrivateJson(path.join(directory, manifestName), {
      ...manifest,
      status: "interrupted",
      completedAt: new Date().toISOString(),
      warning: "上次运行在进程结束前未完成",
    }).catch(() => undefined);
  }
}

async function purgeOldDays() {
  const root = cacheRoot();
  const today = shanghaiDate();
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || entry.name === today) continue;
    const directory = path.join(root, entry.name);
    const containsActive = [...activeDirectories].some((active) => active.startsWith(`${directory}${path.sep}`));
    if (!containsActive) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function enforceCapacity() {
  const operations = await Promise.all((await operationDirectories()).map(async (directory) => ({
    directory,
    manifest: await readManifest(directory),
    sizeBytes: await directorySize(directory),
  })));
  let total = operations.reduce((sum, operation) => sum + operation.sizeBytes, 0);
  const limit = cacheLimitBytes();
  if (total <= limit) return;
  const removable = operations
    .filter((operation) => !activeDirectories.has(operation.directory) && operation.manifest?.status !== "active")
    .sort((left, right) => {
      const leftFailure = ["failed", "interrupted"].includes(left.manifest?.status || "") ? 0 : 1;
      const rightFailure = ["failed", "interrupted"].includes(right.manifest?.status || "") ? 0 : 1;
      return leftFailure - rightFailure
        || String(left.manifest?.startedAt || "").localeCompare(String(right.manifest?.startedAt || ""));
    });
  for (const operation of removable) {
    if (total <= limit) break;
    await rm(operation.directory, { recursive: true, force: true }).catch(() => undefined);
    total -= operation.sizeBytes;
  }
}

async function prepareCacheArea() {
  await ensurePrivateDirectory(cacheRoot());
  await markInterruptedOperations();
  await purgeOldDays();
  await enforceCapacity();
}

async function clearOlderSuccessfulGeneration(current: LLMCacheContext) {
  for (const directory of await operationDirectories()) {
    if (directory === current.directory || activeDirectories.has(directory)) continue;
    const manifest = await readManifest(directory);
    if (manifest?.taskType === current.manifest.taskType) {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

function addPending(context: LLMCacheContext, promise: Promise<void>) {
  context.pendingWrites.add(promise);
  void promise.finally(() => context.pendingWrites.delete(promise)).catch(() => undefined);
}

async function writeForContext(context: LLMCacheContext, filePath: string, value: unknown) {
  try {
    await writePrivateJson(filePath, value);
  } catch {
    context.cacheWarning = true;
  }
}

async function completeOperation(context: LLMCacheContext, status: "succeeded" | "failed") {
  await Promise.allSettled([...context.pendingWrites]);
  context.manifest = {
    ...context.manifest,
    status: context.incomplete ? "failed" : status,
    completedAt: new Date().toISOString(),
    warning: context.cacheWarning
      ? "部分缓存文件写入失败，业务结果不受影响"
      : context.incomplete ? "任务包含待人工处理结果，缓存已保留" : null,
  };
  await writePrivateJson(path.join(context.directory, manifestName), context.manifest).catch(() => undefined);
  activeDirectories.delete(context.directory);
  if (status === "succeeded" && !context.incomplete) await clearOlderSuccessfulGeneration(context);
  await enforceCapacity();
}

export async function withLLMCacheOperation<T>(
  taskType: LLMTaskType,
  title: string,
  callback: () => Promise<T>,
): Promise<T> {
  await prepareCacheArea().catch(() => undefined);
  const id = randomUUID();
  const directory = path.join(cacheRoot(), shanghaiDate(), taskType, id);
  const context: LLMCacheContext = {
    directory,
    manifest: {
      id,
      taskType,
      title,
      status: "active",
      startedAt: new Date().toISOString(),
      completedAt: null,
      callCount: 0,
      warning: null,
    },
    nextCall: 1,
    pendingWrites: new Set(),
    cacheWarning: false,
    incomplete: false,
  };
  activeDirectories.add(directory);
  await writeForContext(context, path.join(directory, manifestName), context.manifest);
  try {
    const result = await storage.run(context, callback);
    await completeOperation(context, "succeeded");
    return result;
  } catch (error) {
    await completeOperation(context, "failed");
    throw error;
  }
}

export function markCurrentLLMCacheOperationIncomplete() {
  const context = storage.getStore();
  if (context) context.incomplete = true;
}

function parseResponseBody(body: string) {
  try {
    const payload = JSON.parse(body) as Record<string, any>;
    const choice = payload.choices?.[0] ?? {};
    const message = choice.message ?? {};
    return {
      model: payload.model,
      content: message.content ?? "",
      reasoningContent: message.reasoning_content ?? message.reasoning ?? "",
      finishReason: choice.finish_reason ?? null,
      usage: payload.usage ?? null,
    };
  } catch {
    return { content: body, reasoningContent: "", finishReason: null, usage: null };
  }
}

function parseStreamBody(body: string) {
  let content = "";
  let reasoningContent = "";
  let finishReason: string | null = null;
  let usage: unknown = null;
  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const payload = JSON.parse(data) as Record<string, any>;
      const choice = payload.choices?.[0] ?? {};
      content += choice.delta?.content ?? "";
      reasoningContent += choice.delta?.reasoning_content ?? choice.delta?.reasoning ?? "";
      finishReason = choice.finish_reason ?? finishReason;
      usage = payload.usage ?? usage;
    } catch {
      // Preserve the useful reconstructed output even if a provider emits a non-JSON SSE line.
    }
  }
  return { content, reasoningContent, finishReason, usage };
}

async function readBody(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

export async function llmCacheFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  role = "default",
): Promise<Response> {
  const context = storage.getStore();
  if (!context) return fetch(input, init);

  const callNumber = context.nextCall++;
  context.manifest.callCount = callNumber;
  const callDirectory = path.join(context.directory, "calls", String(callNumber).padStart(3, "0"));
  let requestPayload: unknown = null;
  if (typeof init?.body === "string") {
    try { requestPayload = JSON.parse(init.body); }
    catch { requestPayload = { body: init.body }; }
  }
  await writeForContext(context, path.join(callDirectory, "request.json"), {
    createdAt: new Date().toISOString(),
    role,
    request: requestPayload,
  });
  await writeForContext(context, path.join(context.directory, manifestName), context.manifest);

  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    await writeForContext(context, path.join(callDirectory, "error.json"), {
      failedAt: new Date().toISOString(),
      type: error instanceof Error ? error.name : "NetworkError",
      message: "网络请求未获得响应",
    });
    throw error;
  }

  if (!response.body) {
    await writeForContext(context, path.join(callDirectory, response.ok ? "response.json" : "error.json"), {
      completedAt: new Date().toISOString(),
      status: response.status,
      finishReason: null,
    });
    return response;
  }
  const [clientBody, cacheBody] = response.body.tee();
  const cachedResponse = new Response(clientBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  const cacheWrite = readBody(cacheBody).then(async (body) => {
    if (!response.ok) {
      let providerError: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(body) as Record<string, any>;
        providerError = {
          type: parsed.error?.type,
          code: parsed.error?.code,
          param: parsed.error?.param,
          message: "模型服务返回错误",
        };
      } catch {
        providerError = { message: `HTTP ${response.status}` };
      }
      await writeForContext(context, path.join(callDirectory, "error.json"), {
        failedAt: new Date().toISOString(),
        status: response.status,
        ...providerError,
      });
      return;
    }
    const request = requestPayload && typeof requestPayload === "object" ? requestPayload as Record<string, unknown> : {};
    await writeForContext(context, path.join(callDirectory, "response.json"), {
      completedAt: new Date().toISOString(),
      status: response.status,
      ...(request.stream === true ? parseStreamBody(body) : parseResponseBody(body)),
    });
  }).catch(() => { context.cacheWarning = true; });
  addPending(context, cacheWrite);
  return cachedResponse;
}

export async function getLLMCacheOverview(): Promise<LLMCacheOverview> {
  await prepareCacheArea().catch(() => undefined);
  const operations = (await Promise.all((await operationDirectories()).map(async (directory) => {
    const manifest = await readManifest(directory);
    if (!manifest) return null;
    return { ...manifest, sizeBytes: await directorySize(directory) } satisfies LLMCacheSummary;
  }))).filter((value): value is LLMCacheSummary => value !== null)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  return {
    rootLabel: "data/llm-cache",
    totalSizeBytes: operations.reduce((sum, operation) => sum + operation.sizeBytes, 0),
    maxSizeBytes: cacheLimitBytes(),
    operations,
  };
}

export async function clearLLMCache(taskType?: LLMTaskType) {
  await markInterruptedOperations();
  let removed = 0;
  for (const directory of await operationDirectories()) {
    if (activeDirectories.has(directory)) continue;
    const manifest = await readManifest(directory);
    if (!manifest || (taskType && manifest.taskType !== taskType)) continue;
    await rm(directory, { recursive: true, force: true });
    removed += 1;
  }
  return { removed };
}
