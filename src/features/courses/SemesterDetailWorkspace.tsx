"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, EmptyState, ErrorState, LoadingState, MetricCard, PageHeader, Section } from "@/components/ui";
import { requestJson } from "@/lib/api-client";

interface Session { id: string; code: string; date: string; semesterNumber: number; class: { code: string; name: string | null } | null; _count: { attendances: number }; }
interface SemesterDetail { id: string; name: string; startDate: string; endDate: string; sessions: Session[]; sessionCount: number; totalStudents: number; attendances: number; }

export default function SemesterDetailWorkspace() {
  const params = useParams();
  const [semester, setSemester] = useState<SemesterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setSemester(await requestJson<SemesterDetail>(`/api/semesters/${params.id}`)); } catch (reason) { setError(reason instanceof Error ? reason.message : "加载学期详情失败"); } finally { setLoading(false); } }, [params.id]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingState label="正在加载学期详情…" />;
  if (error) return <ErrorState message={error} action={<Button onClick={() => void load()}>重试</Button>} />;
  if (!semester) return <EmptyState title="学期不存在" />;
  return <main className="semester-detail-workspace"><PageHeader title={semester.name} description={`${semester.startDate} → ${semester.endDate}`} /><div className="semester-metrics"><MetricCard label="课次总数" value={semester.sessionCount} tone="brand" /><MetricCard label="学生总数" value={semester.totalStudents} tone="success" /><MetricCard label="考勤记录总数" value={semester.attendances} tone="warning" /></div><Section title="课次列表" description="按日期查看学期内已经建立的课次。">{semester.sessions.length === 0 ? <EmptyState title="暂无课次记录" /> : <div className="semester-session-table-wrap"><table className="semester-session-table"><thead><tr><th>课次编码</th><th>日期</th><th>学期序号</th><th>班级</th><th>考勤人数</th></tr></thead><tbody>{semester.sessions.map((session) => <tr key={session.id}><td>{session.code}</td><td>{session.date}</td><td>第 {session.semesterNumber} 次</td><td>{session.class ? (session.class.name ?? session.class.code) : "全校"}</td><td>{session._count.attendances}</td></tr>)}</tbody></table></div>}</Section></main>;
}
