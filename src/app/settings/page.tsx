"use client";

import { useEffect, useMemo, useState } from "react";

interface LLMProfile {
  id: string;
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

interface LLMSettingsResponse {
  activeProfileId: string | null;
  profiles: LLMProfile[];
  effectiveSettings: {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    updatedAt?: string;
  };
}

interface WeComImportPlanItem {
  student: { id: string; name: string; studentId: string };
  session: { id: string; code: string; date: string; semesterNumber: number };
  source: { conversationId: string; conversationTitle: string };
  occurredAt: string;
  target: string;
  summary: string;
  duplicate: boolean;
  binding: "explicit_session" | "first_class_session_fallback";
}

interface WeComImportSkippedItem {
  title: string;
  name: string;
  reason: string;
}

interface WeComImportResult {
  sourceLabel: string;
  mode: "dry-run" | "apply";
  communicationCandidateCount: number;
  aiContextCandidateCount: number;
  importableCount: number;
  createCount: number;
  duplicateCount: number;
  skippedCount: number;
  createdCount: number;
  backupPath?: string;
  plans: WeComImportPlanItem[];
  skipped: WeComImportSkippedItem[];
}

interface WeComCandidatePath {
  path: string;
  modifiedAt: string;
}

interface WeComCatchResult {
  command: string;
  scriptPath: string;
  stdout: string;
  stderr: string;
  parsed: unknown | null;
  warning?: string;
}

type LLMProfileForm = Partial<LLMProfile> & {
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
};

const EMPTY_FORM: LLMProfileForm = {
  name: "LM Studio",
  apiBaseUrl: "http://localhost:1234/v1",
  apiKey: "lm-studio",
  model: "",
};

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<LLMProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [form, setForm] = useState<LLMProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [wecomJsonPath, setWecomJsonPath] = useState("");
  const [wecomJsonText, setWecomJsonText] = useState("");
  const [wecomFileName, setWecomFileName] = useState("");
  const [wecomCandidates, setWecomCandidates] = useState<WeComCandidatePath[]>([]);
  const [wecomIncludeMedium, setWecomIncludeMedium] = useState(false);
  const [wecomLoading, setWecomLoading] = useState(false);
  const [wecomResult, setWecomResult] = useState<WeComImportResult | null>(null);
  const [wecomStatus, setWecomStatus] = useState("");
  const [wecomError, setWecomError] = useState("");
  const [wecomCatchLoading, setWecomCatchLoading] = useState(false);
  const [wecomCatchResult, setWecomCatchResult] = useState<WeComCatchResult | null>(null);
  const [wecomCatchError, setWecomCatchError] = useState("");
  const [wecomBridgeText, setWecomBridgeText] = useState("");
  const [wecomBridgeLoading, setWecomBridgeLoading] = useState(false);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [activeProfileId, profiles]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch("/api/settings/llm");
        const data: LLMSettingsResponse = await res.json();
        if (cancelled) return;

        setProfiles(data.profiles || []);
        setActiveProfileId(data.activeProfileId);

        const selected = data.profiles?.find((profile) => profile.id === data.activeProfileId) ?? data.profiles?.[0];
        if (selected) {
          setSelectedProfileId(selected.id);
          setForm({
            id: selected.id,
            name: selected.name,
            apiBaseUrl: selected.apiBaseUrl,
            apiKey: selected.apiKey,
            model: selected.model,
            createdAt: selected.createdAt,
            updatedAt: selected.updatedAt,
          });
        } else {
          setSelectedProfileId(null);
          setForm({
            ...EMPTY_FORM,
            apiBaseUrl: data.effectiveSettings?.apiBaseUrl || EMPTY_FORM.apiBaseUrl,
            apiKey: data.effectiveSettings?.apiKey || EMPTY_FORM.apiKey,
            model: data.effectiveSettings?.model || EMPTY_FORM.model,
          });
        }
      } catch {
        if (!cancelled) setError("读取设置失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWeComCandidates() {
      try {
        const res = await fetch("/api/wecom/import");
        const data = await res.json();
        if (cancelled) return;
        setWecomCandidates(data.candidates || []);
        if (data.suggestedPath) setWecomJsonPath(data.suggestedPath);
      } catch {
        if (!cancelled) setWecomError("读取企微 JSON 建议路径失败");
      }
    }

    void loadWeComCandidates();
    return () => { cancelled = true; };
  }, []);

  function applyStore(data: LLMSettingsResponse, preferredId?: string) {
    setProfiles(data.profiles || []);
    setActiveProfileId(data.activeProfileId);
    const next =
      data.profiles?.find((profile) => profile.id === preferredId) ??
      data.profiles?.find((profile) => profile.id === data.activeProfileId) ??
      data.profiles?.[0];

    if (next) selectProfile(next);
    else newProfile();
  }

  function selectProfile(profile: LLMProfile) {
    setSelectedProfileId(profile.id);
    setForm({
      id: profile.id,
      name: profile.name,
      apiBaseUrl: profile.apiBaseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
    setModels([]);
    setStatus("");
    setError("");
  }

  function newProfile() {
    setSelectedProfileId(null);
    setForm(EMPTY_FORM);
    setModels([]);
    setStatus("");
    setError("");
  }

  function updateField(field: keyof LLMProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus("");
    setError("");
  }

  async function saveProfile(activate = true) {
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: selectedProfileId || form.id, activate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      const saved = data.profiles?.find((profile: LLMProfile) =>
        selectedProfileId ? profile.id === selectedProfileId : profile.name === form.name
      );
      applyStore(data, saved?.id);
      setStatus(activate ? "已保存并启用。" : "已保存。");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function activateProfile(id: string | null = selectedProfileId) {
    if (!id) return;
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProfileId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "切换失败");
      applyStore(data, id);
      setStatus("已启用此配置。");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    if (!selectedProfileId) return;
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch(`/api/settings/llm?id=${encodeURIComponent(selectedProfileId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      applyStore(data);
      setStatus("已删除配置。");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearAllProfiles() {
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch("/api/settings/llm", { method: "DELETE" });
      const data = await res.json();
      applyStore(data);
      setStatus("已清除所有 Web UI 保存的配置。");
    } catch {
      setError("清除设置失败");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setStatus("");
    setError("");
    setModels([]);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "连接失败");
      setModels(data.models || []);
      setStatus("连接成功。");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  }

  async function chooseWeComFile(file: File | undefined) {
    setWecomResult(null);
    setWecomStatus("");
    setWecomError("");
    if (!file) {
      setWecomJsonText("");
      setWecomFileName("");
      return;
    }
    if (!file.name.endsWith(".json")) {
      setWecomError("请上传 JSON 文件");
      return;
    }
    setWecomFileName(file.name);
    setWecomJsonText(await file.text());
  }

  async function runWeComImport(apply: boolean) {
    if (apply && wecomResult && wecomResult.createCount <= 0) {
      setWecomError("当前预览没有可新增记录");
      return;
    }
    if (apply && !confirm(`确认写入 ${wecomResult?.createCount ?? 0} 条家校沟通记录？写入前会自动备份数据库。`)) return;

    setWecomLoading(true);
    setWecomStatus("");
    setWecomError("");
    try {
      const res = await fetch("/api/wecom/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonPath: wecomJsonText ? "" : wecomJsonPath,
          jsonText: wecomJsonText,
          includeMedium: wecomIncludeMedium,
          apply,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "导入失败");
      setWecomResult(data);
      setWecomStatus(apply ? `已写入 ${data.createdCount} 条家校沟通记录。` : "预览完成，尚未写入。");
    } catch (e: any) {
      setWecomError(e.message);
    } finally {
      setWecomLoading(false);
    }
  }

  function formatWeComCatchOutput(result: WeComCatchResult | null) {
    if (!result) return "";
    if (result.parsed) return JSON.stringify(result.parsed, null, 2);
    return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  }

  async function runWeComCatch(action: "status" | "sync-start" | "sync-status" | "export") {
    if (action === "sync-start") {
      const ok = confirm("企微同步可能切换会话并改变未读状态。请确认 Mac 已解锁，并且同步期间不要调整企微窗口。");
      if (!ok) return;
    }

    setWecomCatchLoading(true);
    setWecomCatchError("");
    try {
      const path = `/api/wecomcatch/${action}`;
      const res = await fetch(path, { method: action === "status" || action === "sync-status" ? "GET" : "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "WeComCatch 操作失败");
      setWecomCatchResult(data);
      if (action === "export" && data.stdout) setWecomBridgeText(data.stdout);
    } catch (e: any) {
      setWecomCatchError(e.message);
    } finally {
      setWecomCatchLoading(false);
    }
  }

  async function generateWeComBridge() {
    if (!wecomBridgeText.trim()) {
      setWecomError("请先粘贴企微导出文本，或点击 WeComCatch 导出后再生成候选 JSON");
      return;
    }

    setWecomBridgeLoading(true);
    setWecomStatus("");
    setWecomError("");
    try {
      const res = await fetch("/api/wecom/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: wecomBridgeText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成企微候选 JSON 失败");
      setWecomJsonText(JSON.stringify(data.bridgeJson, null, 2));
      setWecomJsonPath("");
      setWecomFileName("LLM 生成的企微候选 JSON");
      setWecomResult(null);
      setWecomStatus("已生成企微候选 JSON，可以先预览导入。");
    } catch (e: any) {
      setWecomError(e.message);
    } finally {
      setWecomBridgeLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">系统设置</h2>
        <p className="text-sm text-gray-500 mt-1">管理本地 LLM 配置和数据导入入口。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">LLM 配置</h3>
            <button onClick={newProfile} className="text-sm text-blue-600 hover:text-blue-700">新增</button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">读取中...</div>
          ) : profiles.length === 0 ? (
            <div className="text-sm text-gray-500">还没有保存的配置。</div>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => {
                const selected = profile.id === selectedProfileId;
                const active = profile.id === activeProfileId;
                return (
                  <button
                    key={profile.id}
                    onClick={() => selectProfile(profile)}
                    className={`w-full text-left rounded-md border px-3 py-2 text-sm ${
                      selected ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 truncate">{profile.name}</span>
                      {active && <span className="shrink-0 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded px-1.5">启用</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 truncate">{profile.model}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-800">编辑配置</h3>
            <p className="text-sm text-gray-500 mt-1">
              LM Studio 默认地址通常是 http://localhost:1234/v1，API Key 可以填 lm-studio。
            </p>
          </div>

          {activeProfile && (
            <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              当前启用：{activeProfile.name} / {activeProfile.model}
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700">配置名称</span>
            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如 LM Studio 本地 / OpenAI 备用"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">API Base URL</span>
            <input
              value={form.apiBaseUrl}
              onChange={(e) => updateField("apiBaseUrl", e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="http://localhost:1234/v1"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">API Key</span>
            <input
              value={form.apiKey}
              onChange={(e) => updateField("apiKey", e.target.value)}
              type="password"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="lm-studio"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">模型名</span>
            <input
              value={form.model}
              onChange={(e) => updateField("model", e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如 lmstudio-community/qwen2.5-7b-instruct"
            />
          </label>

          {form.updatedAt && (
            <p className="text-xs text-gray-400">上次保存：{new Date(form.updatedAt).toLocaleString()}</p>
          )}

          {status && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{status}</div>}
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          {models.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-xs font-medium text-gray-500 mb-1">服务返回的模型</div>
              <div className="flex flex-wrap gap-2">
                {models.map((model) => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => updateField("model", model)}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:border-blue-300 hover:text-blue-700"
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => saveProfile(true)}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存并启用"}
            </button>
            <button
              onClick={() => saveProfile(false)}
              disabled={saving}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              仅保存
            </button>
            <button
              onClick={() => activateProfile()}
              disabled={saving || !selectedProfileId || selectedProfileId === activeProfileId}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              启用此配置
            </button>
            <button
              onClick={testConnection}
              disabled={testing}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? "测试中..." : "测试连接"}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
            <button
              onClick={deleteProfile}
              disabled={saving || !selectedProfileId}
              className="px-4 py-2 rounded-md border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              删除当前配置
            </button>
            <button
              onClick={clearAllProfiles}
              disabled={saving}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              清除全部 Web 配置
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">WeComCatch 手动同步</h3>
            <p className="text-sm text-gray-500 mt-1">
              只通过固定 wrapper 脚本读取状态、启动同步和导出记录；不会自动同步企微。
            </p>
          </div>
          <a href="/feedback" className="text-sm text-blue-600 hover:text-blue-700">去课后反馈工作台</a>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runWeComCatch("status")}
            disabled={wecomCatchLoading}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            读取状态
          </button>
          <button
            onClick={() => runWeComCatch("sync-start")}
            disabled={wecomCatchLoading}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          >
            启动同步
          </button>
          <button
            onClick={() => runWeComCatch("sync-status")}
            disabled={wecomCatchLoading}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            同步进度
          </button>
          <button
            onClick={() => runWeComCatch("export")}
            disabled={wecomCatchLoading}
            className="px-4 py-2 rounded-md border border-green-200 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            导出记录
          </button>
        </div>

        {wecomCatchError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{wecomCatchError}</div>}
        {wecomCatchResult?.warning && <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{wecomCatchResult.warning}</div>}
        {wecomCatchResult && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {wecomCatchResult.command} · {wecomCatchResult.scriptPath}
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap p-3 text-xs text-gray-700">
              {formatWeComCatchOutput(wecomCatchResult) || "命令已执行，无输出。"}
            </pre>
          </div>
        )}

        <div className="border-t border-gray-100 pt-5">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">生成 Chem-Track 候选 JSON</h4>
          <p className="text-xs text-gray-500 mb-3">
            可粘贴 WeComCatch 导出内容或一段聊天记录，由当前 LLM 配置提取为家校沟通候选，再进入下面的预览导入。
          </p>
          <textarea
            value={wecomBridgeText}
            onChange={(e) => setWecomBridgeText(e.target.value)}
            placeholder="粘贴企微导出内容或聊天记录。点击「导出记录」后，如果脚本返回文本，也会自动填入这里。"
            className="w-full min-h-[120px] rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button
              onClick={generateWeComBridge}
              disabled={wecomBridgeLoading || !wecomBridgeText.trim()}
              className="px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {wecomBridgeLoading ? "生成中..." : "生成候选 JSON"}
            </button>
            {wecomFileName && (
              <span className="text-xs border border-blue-100 bg-blue-50 text-blue-700 rounded px-2 py-1">
                当前候选：{wecomFileName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">企微家校沟通导入</h3>
            <p className="text-sm text-gray-500 mt-1">
              从 chemtrack-wecom-bridge JSON 预览并导入家校沟通；未知课次会绑定学生所在班级第一次课。
            </p>
          </div>
          {wecomFileName && (
            <span className="text-xs border border-blue-100 bg-blue-50 text-blue-700 rounded px-2 py-1">
              已选择 {wecomFileName}
            </span>
          )}
        </div>

        {wecomCandidates.length > 0 && (
          <label className="block">
            <span className="text-sm font-medium text-gray-700">最近生成的 JSON</span>
            <select
              value={wecomJsonPath}
              onChange={(e) => {
                setWecomJsonPath(e.target.value);
                setWecomJsonText("");
                setWecomFileName("");
                setWecomResult(null);
              }}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {wecomCandidates.map((item) => (
                <option key={item.path} value={item.path}>
                  {item.path} · {new Date(item.modifiedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-gray-700">JSON 文件路径</span>
          <input
            value={wecomJsonPath}
            onChange={(e) => {
              setWecomJsonPath(e.target.value);
              setWecomJsonText("");
              setWecomFileName("");
              setWecomResult(null);
            }}
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="$HOME/.openclaw/workspace/.../chemtrack-bridge.json"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={wecomIncludeMedium}
              onChange={(e) => {
                setWecomIncludeMedium(e.target.checked);
                setWecomResult(null);
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            包含中等置信度学生匹配
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <span className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer">
              上传 JSON
            </span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => void chooseWeComFile(e.target.files?.[0])}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runWeComImport(false)}
            disabled={wecomLoading || (!wecomJsonPath && !wecomJsonText)}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {wecomLoading ? "处理中..." : "预览导入"}
          </button>
          <button
            onClick={() => runWeComImport(true)}
            disabled={wecomLoading || !wecomResult || wecomResult.createCount <= 0}
            className="px-4 py-2 rounded-md border border-green-200 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            确认写入
          </button>
        </div>

        {wecomStatus && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{wecomStatus}</div>}
        {wecomError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{wecomError}</div>}

        {wecomResult && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-gray-200 text-center text-sm">
              <div className="bg-gray-50 p-3"><div className="text-xs text-gray-400">沟通候选</div><div className="font-semibold text-gray-800">{wecomResult.communicationCandidateCount}</div></div>
              <div className="bg-gray-50 p-3"><div className="text-xs text-gray-400">可入库</div><div className="font-semibold text-gray-800">{wecomResult.importableCount}</div></div>
              <div className="bg-gray-50 p-3"><div className="text-xs text-gray-400">将新增</div><div className="font-semibold text-green-700">{wecomResult.createCount}</div></div>
              <div className="bg-gray-50 p-3"><div className="text-xs text-gray-400">重复</div><div className="font-semibold text-gray-800">{wecomResult.duplicateCount}</div></div>
              <div className="bg-gray-50 p-3"><div className="text-xs text-gray-400">跳过</div><div className="font-semibold text-amber-700">{wecomResult.skippedCount}</div></div>
              <div className="bg-gray-50 p-3"><div className="text-xs text-gray-400">AI 上下文</div><div className="font-semibold text-gray-800">{wecomResult.aiContextCandidateCount}</div></div>
            </div>

            <div className="p-4 space-y-4">
              {wecomResult.backupPath && (
                <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">备份：{wecomResult.backupPath}</div>
              )}

              {wecomResult.plans.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">可导入记录</h4>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {wecomResult.plans.map((plan) => (
                      <div key={`${plan.student.id}-${plan.session.id}-${plan.summary}`} className="rounded-md border border-gray-200 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
                          <span className="font-medium text-gray-800">{plan.student.name}</span>
                          <span>{plan.student.studentId}</span>
                          <span>{plan.session.code}</span>
                          <span>{plan.binding === "first_class_session_fallback" ? "第一次课锚点" : "指定课次"}</span>
                          {plan.duplicate && <span className="text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5">重复</span>}
                        </div>
                        <p className="text-sm text-gray-700 leading-6">{plan.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {wecomResult.skipped.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">跳过项</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {wecomResult.skipped.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="text-sm text-gray-500">
                        {item.name || "未知学生"} / {item.title || "未知会话"}：{item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
