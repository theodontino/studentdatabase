"use client";

import { Badge, Button, Drawer, EmptyState, MetricCard, StatusBanner } from "@/components/ui";
import type { StudentDetail, StudentDetailPanel } from "./types";
import { studentDetailPanelTitle, studentEventTone } from "./types";

const SUMMARY_LIMIT = 3;

interface StudentRecordsProps {
  student: StudentDetail;
  activePanel: StudentDetailPanel | null;
  setActivePanel: (panel: StudentDetailPanel | null) => void;
  eventHasMore: boolean;
  commHasMore: boolean;
  loadingMore: "events" | "comms" | null;
  recordsError: string;
  loadMoreEvents: () => Promise<void>;
  loadMoreCommunications: () => Promise<void>;
}

function RecordCard({ title, description, testId, onOpen, children }: { title: string; description: string; testId: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <section className="student-record-card">
      <header>
        <div><h2>{title}</h2><p>{description}</p></div>
        <Button data-testid={testId} variant="ghost" uiSize="sm" onClick={onOpen}>查看全部</Button>
      </header>
      <div className="student-record-card__body">{children}</div>
    </section>
  );
}

export function StudentRecords(props: StudentRecordsProps) {
  const {
    student, activePanel, setActivePanel, eventHasMore, commHasMore, loadingMore,
    recordsError, loadMoreEvents, loadMoreCommunications,
  } = props;
  const summary = student.semesterSummary;
  const totalSessions = summary?.attendanceRecordedCount ?? student.attendances.length;
  const presentCount = summary?.presentCount ?? student.attendances.filter((attendance) => attendance.present).length;
  const absentCount = totalSessions - presentCount;
  const eventSummary = student.events.slice(0, SUMMARY_LIMIT);
  const communicationSummary = student.communications.slice(0, SUMMARY_LIMIT);
  const attendanceSummary = student.attendances.slice(0, SUMMARY_LIMIT);

  return (
    <>
      <div className="student-record-grid">
        <RecordCard title="关键事件" description={`最近 ${eventSummary.length} 条 · 已载入 ${student.events.length} 条`} testId="student-records-view-events" onOpen={() => setActivePanel("events")}>
          {eventSummary.length ? eventSummary.map((event) => (
            <article key={event.id} className="student-record-row">
              <time>{event.session.date}</time>
              <Badge tone={studentEventTone(event.type)}>{event.type}</Badge>
              <div><p>{event.description}</p>{event.rawText && <small>{event.rawText}</small>}</div>
            </article>
          )) : <EmptyState title="暂无事件" />}
        </RecordCard>

        <RecordCard title="家校沟通" description={`最近 ${communicationSummary.length} 条 · 已载入 ${student.communications.length} 条`} testId="student-records-view-communications" onOpen={() => setActivePanel("communications")}>
          {communicationSummary.length ? communicationSummary.map((communication) => (
            <article key={communication.id} className="student-record-row">
              <time>{communication.session.date}</time>
              <Badge tone="warning">{communication.target}</Badge>
              <div><p>{communication.summary}</p></div>
            </article>
          )) : <EmptyState title="暂无记录" />}
        </RecordCard>

        <RecordCard title="考勤记录" description={`出勤 ${presentCount}/${totalSessions} · 缺勤 ${absentCount}`} testId="student-records-view-attendance" onOpen={() => setActivePanel("attendance")}>
          {attendanceSummary.length ? attendanceSummary.map((attendance) => (
            <article key={attendance.id} className="student-attendance-row">
              <Badge tone={attendance.present ? "success" : "danger"}>{attendance.present ? "出勤" : "缺勤"}</Badge>
              <span>第{attendance.session.semesterNumber}课</span>
              <time>{attendance.session.date}</time>
            </article>
          )) : <EmptyState title="暂无记录" />}
        </RecordCard>
      </div>

      <Drawer open={activePanel !== null} size="wide" title={activePanel ? `${student.name} · ${studentDetailPanelTitle(activePanel)}` : "学生记录"} onClose={() => setActivePanel(null)}>
        {activePanel && (
          <div data-testid="student-records-panel" className="student-records-panel">
            <div className="student-records-tabs" role="tablist" aria-label="学生记录类型">
              {(["events", "communications", "attendance"] as StudentDetailPanel[]).map((panel) => (
                <Button key={panel} data-testid={`student-records-tab-${panel}`} role="tab" aria-selected={activePanel === panel} variant={activePanel === panel ? "primary" : "secondary"} uiSize="sm" onClick={() => setActivePanel(panel)}>
                  {studentDetailPanelTitle(panel)}
                </Button>
              ))}
            </div>
            {recordsError && <StatusBanner tone="danger">{recordsError}，请重试。</StatusBanner>}

            {activePanel === "events" && <div className="student-records-list">
              {student.events.length ? student.events.map((event) => (
                <article key={event.id} className="student-record-detail">
                  <header><time>{event.session.date}</time><span>第{event.session.semesterNumber}课</span><span>{event.session.code}</span><Badge tone={studentEventTone(event.type)}>{event.type}</Badge></header>
                  <p>{event.description}</p>
                  {event.rawText && <blockquote><small>原始片段</small>{event.rawText}</blockquote>}
                </article>
              )) : <EmptyState title="暂无事件" />}
              {eventHasMore && <Button variant="ghost" disabled={loadingMore === "events"} onClick={() => void loadMoreEvents()}>{loadingMore === "events" ? "加载中…" : "加载更多事件"}</Button>}
            </div>}

            {activePanel === "communications" && <div className="student-records-list">
              {student.communications.length ? student.communications.map((communication) => (
                <article key={communication.id} className="student-record-detail">
                  <header><time>{communication.session.date}</time><span>{communication.session.code}</span><Badge tone="warning">{communication.target}</Badge></header>
                  <p>{communication.summary}</p>
                </article>
              )) : <EmptyState title="暂无家校沟通记录" />}
              {commHasMore && <Button variant="ghost" disabled={loadingMore === "comms"} onClick={() => void loadMoreCommunications()}>{loadingMore === "comms" ? "加载中…" : "加载更多沟通记录"}</Button>}
            </div>}

            {activePanel === "attendance" && <div className="student-records-list">
              <div className="student-records-metrics">
                <MetricCard label="总记录" value={totalSessions} />
                <MetricCard label="出勤" value={presentCount} tone="success" />
                <MetricCard label="缺勤" value={absentCount} tone={absentCount > 0 ? "danger" : "neutral"} />
              </div>
              {student.attendances.length ? student.attendances.map((attendance) => (
                <article key={attendance.id} className="student-attendance-detail">
                  <Badge tone={attendance.present ? "success" : "danger"}>{attendance.present ? "出勤" : "缺勤"}</Badge>
                  <span>第{attendance.session.semesterNumber}课</span><time>{attendance.session.date}</time><small>{attendance.session.code}</small>
                </article>
              )) : <EmptyState title="暂无考勤记录" />}
            </div>}
          </div>
        )}
      </Drawer>
    </>
  );
}
