"use client";

import { useState, useEffect } from "react";

export default function ReportPage() {
  // Shared state
  const [semesters, setSemesters] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; class: string }[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // Daily report
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyReport, setDailyReport] = useState("");

  // Feedback
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [feedbackDays, setFeedbackDays] = useState(14);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    fetch("/api/semesters").then((r) => r.json()).then(setSemesters);
    fetch("/api/students").then((r) => r.json()).then((ss: any[]) => {
      setClasses([...new Set(ss.map((s) => s.class))]);
      setStudents(ss);
    });
  }, []);

  async function generateDaily() {
    if (!selectedSemesterId || !selectedClass || !selectedDate) return;
    setDailyLoading(true);
    try {
      const res = await fetch("/api/report/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: selectedSemesterId, className: selectedClass, date: selectedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDailyReport(data.report);
    } catch (e: any) { alert(e.message); }
    finally { setDailyLoading(false); }
  }

  async function generateFeedback() {
    if (!selectedStudentId) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch("/api/report/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudentId, days: feedbackDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedbackText(data.feedback);
    } catch (e: any) { alert(e.message); }
    finally { setFeedbackLoading(false); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">报告生成</h2>
      <p className="text-sm text-gray-500 mb-6">AI 生成班级日报和家校反馈文本。</p>

      {/* Shared Selectors */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <select value={selectedSemesterId} onChange={(e) => setSelectedSemesterId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">选择学期</option>
          {semesters.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">选择班级</option>
          {classes.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <input type="date" value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
      </div>

      {/* Daily Report */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">📰 班级日报</h3>
        <button onClick={generateDaily} disabled={dailyLoading || !selectedSemesterId || !selectedClass}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mb-4">
          {dailyLoading ? "生成中..." : "生成日报"}
        </button>
        {dailyReport && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {dailyReport}
          </div>
        )}
      </div>

      {/* Feedback */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">💬 家校反馈</h3>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">选择学生</option>
            {students.filter((s) => !selectedClass || s.class === selectedClass).map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
            ))}
          </select>
          <select value={feedbackDays} onChange={(e) => setFeedbackDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
            <option value={7}>近 7 天</option>
            <option value={14}>近 14 天</option>
            <option value={30}>近 30 天</option>
          </select>
          <button onClick={generateFeedback} disabled={feedbackLoading || !selectedStudentId}
            className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {feedbackLoading ? "生成中..." : "生成反馈"}
          </button>
        </div>
        {feedbackText && (
          <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {feedbackText}
          </div>
        )}
      </div>
    </div>
  );
}
