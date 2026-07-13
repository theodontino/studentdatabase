export interface ClassOverview {
  name: string;
  avgA: number;
  avgB: number;
  avgC: number;
  avgD: number;
  studentCount: number;
  lastActivityAt: string;
}

export interface ClassAlert {
  className: string;
  dimension: string;
  avgScore: number;
  severity: "red" | "yellow";
}

export interface StudentAlert {
  studentId: string;
  studentName: string;
  class: string;
  dimension: string;
  score: number;
  classAvg: number;
  deviation: number;
  severity: "red" | "yellow";
  lastActivityAt: string;
}

export interface DashboardData {
  semester: { id: string; name: string; startDate: string; endDate: string } | null;
  classOverview: ClassOverview[];
  classAlerts: ClassAlert[];
  studentAlerts: StudentAlert[];
  totalStudents: number;
  redCount: number;
  yellowCount: number;
}
