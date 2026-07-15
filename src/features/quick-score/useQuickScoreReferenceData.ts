"use client";

import { useCallback, useEffect, useState } from "react";
import { loadQuickScoreReferenceData } from "./api";
import type { QuickScoreNotice, QuickScoreSemester, QuickScoreStudent } from "./types";

export function useQuickScoreReferenceData(setNotice: (notice: QuickScoreNotice | null) => void) {
  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<QuickScoreStudent[]>([]);
  const [semesters, setSemesters] = useState<QuickScoreSemester[]>([]);
  const [showSemesterModal, setShowSemesterModal] = useState(false);

  const refresh = useCallback(async () => {
    setNotice(null);
    try {
      const data = await loadQuickScoreReferenceData();
      setStudents(data.students);
      setClasses([...new Set(data.students.map((student) => student.class))]);
      setSemesters(data.semesters);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "加载学生和学期失败" });
    }
  }, [setNotice]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { classes, students, semesters, setSemesters, showSemesterModal, setShowSemesterModal, refresh };
}
