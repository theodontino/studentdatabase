"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  sessionCount: number;
}

export default function SemestersPage() {
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/semesters")
      .then((r) => r.json())
      .then(setSemesters)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-gray-400">加载中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">学期管理</h2>

      {semesters.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          暂无学期
        </div>
      ) : (
        <div className="space-y-3">
          {semesters.map((sem) => (
            <div
              key={sem.id}
              onClick={() => router.push(`/semesters/${sem.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{sem.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {sem.startDate} → {sem.endDate}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-blue-600">{sem.sessionCount}</div>
                  <div className="text-xs text-gray-400">课次</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
