"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { requestJson } from "@/lib/api-client";
import { SemesterDialog } from "./SemesterDialog";

interface Semester { id: string; name: string; startDate: string; endDate: string; sessionCount: number; }

export default function SemestersWorkspace() {
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  async function load() { setLoading(true); setError(""); try { setSemesters(await requestJson<Semester[]>("/api/semesters")); } catch (reason) { setError(reason instanceof Error ? reason.message : "加载学期失败"); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  if (loading) return <LoadingState label="正在加载学期…" />;
  if (error) return <ErrorState message={error} action={<Button onClick={() => void load()}>重试</Button>} />;
  return <main className="semesters-workspace"><PageHeader title="学期 / 课次" description="管理教学周期并进入课次详情。" actions={<Button onClick={() => setDialogOpen(true)}>新建学期</Button>} />{semesters.length === 0 ? <EmptyState title="暂无学期" description="新建学期后即可开始管理课次。" action={<Button onClick={() => setDialogOpen(true)}>新建第一个学期</Button>} /> : <div className="semester-list">{semesters.map((semester) => <button type="button" key={semester.id} onClick={() => router.push(`/semesters/${semester.id}`)}><span><strong>{semester.name}</strong><small>{semester.startDate} → {semester.endDate}</small></span><span><strong>{semester.sessionCount}</strong><small>课次</small></span></button>)}</div>}<SemesterDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={(semester) => setSemesters((current) => [semester as Semester, ...current])} /></main>;
}
