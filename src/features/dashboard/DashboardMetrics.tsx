import { MetricCard } from "@/components/ui";
import type { DashboardData } from "./types";

export default function DashboardMetrics({ data }: { data: DashboardData }) {
  return <div className="dashboard-metrics">
    <MetricCard label="本学期学生" value={data.totalStudents} detail="有本学期教学记录" tone="brand" />
    <MetricCard label="本学期班级" value={data.classOverview.length} detail="按最近参与课次归属" />
    <MetricCard label="严重预警" value={data.redCount} detail={data.redCount > 0 ? "建议优先查看" : "当前没有严重预警"} tone={data.redCount > 0 ? "danger" : "neutral"} />
    <MetricCard label="关注预警" value={data.yellowCount} detail={data.yellowCount > 0 ? "需要持续观察" : "当前没有关注预警"} tone={data.yellowCount > 0 ? "warning" : "neutral"} />
  </div>;
}
