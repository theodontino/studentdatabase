"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, Section, StatusBanner, StatusDot } from "@/components/ui";
import type { ClassAlert, StudentAlert } from "./types";

function alertTone(severity: "red" | "yellow") {
  return severity === "red" ? "danger" as const : "warning" as const;
}

function studentReason(alert: StudentAlert) {
  return alert.dimension === "考勤"
    ? `累计缺勤 ${alert.score} 次，本班共 ${alert.classAvg} 次课`
    : `得分 ${alert.score}，班级均分 ${alert.classAvg}，偏差 ${alert.deviation}`;
}

export default function DashboardAlerts({ semesterId, totalStudents, classAlerts, studentAlerts }: { semesterId?: string; totalStudents: number; classAlerts: ClassAlert[]; studentAlerts: StudentAlert[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const visibleStudentAlerts = expanded ? studentAlerts : studentAlerts.slice(0, 5);

  if (totalStudents === 0) return <Section title="需要关注"><EmptyState title="暂无学生状态记录" description="完成本学期课次录入后，这里会显示需要关注的班级和学生。" /></Section>;
  if (classAlerts.length === 0 && studentAlerts.length === 0) return <Section title="需要关注"><div className="p-4"><StatusBanner tone="success">本学期未触发班级或学生预警。</StatusBanner></div></Section>;

  return <div className="dashboard-alerts">
    {classAlerts.length > 0 && <Section title="班级预警" description="班级平均表现达到预警规则时显示" actions={<Badge tone={classAlerts.some((item) => item.severity === "red") ? "danger" : "warning"}>{classAlerts.length} 条</Badge>}>
      <div className="dashboard-alert-list">{classAlerts.map((alert) => <div key={`${alert.className}-${alert.dimension}`} className="dashboard-alert-row"><StatusDot tone={alertTone(alert.severity)} label={alert.severity === "red" ? "严重" : "关注"} /><div><strong>{alert.className}</strong><p>{alert.dimension}均分 {alert.avgScore}，已达到{alert.severity === "red" ? "严重" : "关注"}预警范围。</p></div></div>)}</div>
    </Section>}

    {studentAlerts.length > 0 && <Section title="学生预警" description="按班级相对表现与考勤规则生成" actions={<Badge tone={studentAlerts.some((item) => item.severity === "red") ? "danger" : "warning"}>{studentAlerts.length} 条</Badge>}>
      <div className="dashboard-alert-list">{visibleStudentAlerts.map((alert) => <button type="button" key={`${alert.studentId}-${alert.dimension}`} className="dashboard-alert-row dashboard-alert-row--button" onClick={() => router.push(`/students/${alert.studentId}${semesterId ? `?semesterId=${encodeURIComponent(semesterId)}` : ""}`)}><StatusDot tone={alertTone(alert.severity)} label={alert.severity === "red" ? "严重" : "关注"} /><div><strong>{alert.studentName}<span>{alert.class} · {alert.dimension}</span></strong><p>{studentReason(alert)}</p></div><span className="dashboard-alert-row__action">查看档案 →</span></button>)}</div>
      {studentAlerts.length > 5 && <div className="dashboard-alert-footer"><button type="button" onClick={() => setExpanded((current) => !current)}>{expanded ? "收起学生预警" : `展开其余 ${studentAlerts.length - 5} 条`}</button></div>}
    </Section>}
  </div>;
}
