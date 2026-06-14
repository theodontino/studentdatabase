"use client";

import { useState } from "react";

interface Props { onSuccess?: () => void; }

export default function ArchiveButton({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleBackup() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/archive", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "备份失败");
      setMessage(`备份已校验：${data.fileName}`);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "备份失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">数据备份</h3>
          <p className="text-xs text-gray-400 mt-0.5">创建一致性快照并执行完整性与校验和检查</p>
        </div>
        <button
          type="button"
          onClick={handleBackup}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          {loading ? "备份中..." : "立即备份"}
        </button>
      </div>
      {message && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mt-3">{message}</p>}
      {error && <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
    </div>
  );
}
