"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, ErrorState, LoadingState, Section, StatusBanner } from "@/components/ui";
import type { LocalToolAvailability, LocalToolsStatusResponse } from "@/lib/local-tool-status";

const STATUS_LABEL: Record<LocalToolAvailability, string> = {
  available: "可用",
  warning: "需注意",
  unavailable: "不可用",
};

const STATUS_TONE: Record<LocalToolAvailability, "info" | "warning" | "danger"> = {
  available: "info",
  warning: "warning",
  unavailable: "danger",
};

export default function LocalToolStatusPanel() {
  const [data, setData] = useState<LocalToolsStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/local-tools", { cache: "no-store" });
      if (!response.ok) throw new Error("本地工具自检失败");
      setData(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "本地工具自检失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function toggle(toolId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  }

  return (
    <Section
      className="local-tools-panel"
      title="本地工具状态"
      description="只读检查路径和文件，不会安装依赖、启动同步或读取聊天内容。"
      actions={<Button variant="secondary" onClick={() => void load()} disabled={loading}>{loading ? "检查中…" : "重新检查"}</Button>}
    >
      <div className="local-tools-panel__body">
        <StatusBanner tone="warning">音频转写使用 auto 模式时会依次尝试通义听悟、本地 FunASR 和阿里云 ASR，音频可能上传到云端。</StatusBanner>
        {error && <ErrorState message={error} action={<Button onClick={() => void load()}>重试</Button>} />}
        {loading && !data ? <LoadingState label="正在检查本地工具…" /> : <div className="local-tool-grid" aria-live="polite">
          {data?.tools.map((tool) => {
            const open = expanded.has(tool.id);
            return <article key={tool.id} className={`local-tool-card is-${tool.status}`}>
              <header>
                <div className="local-tool-card__identity"><span aria-hidden="true">{tool.id === "funasr" ? "ASR" : "WC"}</span><div><h3>{tool.name}</h3><p>{tool.summary}</p></div></div>
                <Badge tone={STATUS_TONE[tool.status]}>{STATUS_LABEL[tool.status]}</Badge>
              </header>
              {tool.notice && <p className="local-tool-card__notice">{tool.notice}</p>}
              <Button variant="ghost" uiSize="sm" className="local-tool-card__toggle" aria-expanded={open} aria-controls={`local-tool-checks-${tool.id}`} onClick={() => toggle(tool.id)}>{open ? "收起检查详情" : `查看 ${tool.checks.length} 项检查详情`}</Button>
              {open && <div id={`local-tool-checks-${tool.id}`} className="local-tool-checks">
                {tool.checks.map((item) => <div key={item.id} className="local-tool-check">
                  <div><strong>{item.label}</strong><Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge></div>
                  <p>{item.detail}</p>
                  {item.path && <code>{item.path}</code>}
                </div>)}
              </div>}
            </article>;
          })}
        </div>}
        {data && <p className="local-tools-panel__checked-at">上次检查：{new Date(data.checkedAt).toLocaleString("zh-CN")}</p>}
      </div>
    </Section>
  );
}
