"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, SegmentedControl } from "@/components/ui";
import { requestJson } from "@/lib/api-client";
import type { HistoryModule, WorkHistory } from "@/lib/history";

const MODULES: Array<{ value: HistoryModule; label: string }> = [
  { value: "feedback", label: "课后反馈" }, { value: "quick-score", label: "手动评分" },
  { value: "input", label: "课堂录入" }, { value: "report", label: "报告" }, { value: "export", label: "导出" },
];

export default function HistoryWorkspace() {
  const [module, setModule] = useState<HistoryModule>("feedback");
  const [items, setItems] = useState<WorkHistory<unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await requestJson<WorkHistory<unknown>[]>(`/api/history?module=${encodeURIComponent(module)}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "加载历史失败"); }
    finally { setLoading(false); }
  }, [module]);
  useEffect(() => { void load(); }, [load]);

  async function confirmDelete() {
    setClearing(true); setError("");
    try {
      if (deleteId) { await requestJson<{ success: true }>(`/api/history?id=${encodeURIComponent(deleteId)}`, { method: "DELETE" }); setItems((current) => current.filter((item) => item.id !== deleteId)); }
      else { await requestJson<{ success: true }>(`/api/history?module=${encodeURIComponent(module)}`, { method: "DELETE" }); setItems([]); }
      setDeleteId(null); setClearing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除历史失败"); }
    finally { setClearing(false); }
  }

  return <main className="history-workspace">
    <PageHeader title="工作历史" description="查看和清理可恢复的页面工作状态；恢复仍在对应业务页面完成。" actions={<Button variant="danger" onClick={() => setDeleteId("")} disabled={!items.length}>清空当前模块</Button>} />
    <SegmentedControl label="历史模块" items={MODULES} value={module} onChange={(value) => setModule(value as HistoryModule)} />
    <section className="history-list">{loading ? <LoadingState label="加载历史记录中…" /> : error ? <ErrorState message={error} action={<Button onClick={() => void load()}>重试</Button>} /> : items.length === 0 ? <EmptyState title="暂无历史记录" description="在对应工作台保存或生成内容后，历史记录会显示在这里。" /> : items.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{new Date(item.createdAt).toLocaleString("zh-CN")}{item.key ? ` · ${item.key}` : ""}</span></div><Button variant="ghost" uiSize="sm" onClick={() => setDeleteId(item.id)}>删除</Button></article>)}</section>
    <ConfirmDialog open={deleteId !== null} title={deleteId ? "删除历史记录" : "清空当前模块"} description={deleteId ? "确定删除这条历史记录吗？" : "确定清空当前模块的全部历史吗？此操作不可撤销。"} confirmLabel={deleteId ? "删除" : "全部清空"} danger busy={clearing} onConfirm={() => void confirmDelete()} onClose={() => { if (!clearing) setDeleteId(null); }} />
  </main>;
}
