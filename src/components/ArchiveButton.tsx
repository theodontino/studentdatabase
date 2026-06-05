"use client";

import { useState } from "react";

interface Props {
  onSuccess?: () => void;
}

export default function ArchiveButton({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const CONFIRM_WORD = "确认归档";

  async function handleArchive() {
    if (confirmText !== CONFIRM_WORD) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/system/archive", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setConfirmText("");
    setError("");
    setSuccess(false);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">数据管理</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            归档当前数据并重置为种子数据
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
        >
          归档 & 重置数据库
        </button>
      </div>

      {/* 确认对话框 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !loading && handleClose()}
          />
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-6 w-full max-w-md mx-4">
            {success ? (
              <div className="text-center py-4">
                <p className="text-4xl mb-3">🎉</p>
                <p className="text-lg font-semibold text-green-700 mb-2">
                  归档 & 重置完成！
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  数据库已归档至 archives/ 目录，并已重新播种。
                </p>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  关闭
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  ⚠️ 归档 & 重置数据库
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  此操作将：
                </p>
                <ul className="text-sm text-gray-600 mb-4 space-y-1 list-disc list-inside">
                  <li>将当前数据库备份至 <code className="text-xs bg-gray-100 px-1 rounded">archives/</code> 目录</li>
                  <li>清空所有数据并重建表结构</li>
                  <li>重新导入种子数据（示例学生）</li>
                </ul>
                <p className="text-sm font-medium text-red-600 mb-4">
                  所有当前数据将被清空！请确认已备份。
                </p>

                <label className="block mb-1 text-sm text-gray-600">
                  请输入 <span className="font-bold text-red-600">{CONFIRM_WORD}</span> 以确认：
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
                />

                {error && (
                  <p className="text-sm text-red-600 mb-4 bg-red-50 px-3 py-2 rounded">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleArchive}
                    disabled={confirmText !== CONFIRM_WORD || loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        执行中...
                      </span>
                    ) : (
                      "确认归档并重置"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
