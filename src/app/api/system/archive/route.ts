import { execSync } from "child_process";
import { copyFileSync, mkdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

const ROOT = join(process.cwd());
const DB_PATH = join(ROOT, "dev.db");
const ARCHIVE_DIR = join(ROOT, "archives");

export async function POST() {
  try {
    // 1) 归档数据库
    if (!existsSync(DB_PATH)) {
      console.log("⚠️  dev.db 不存在，跳过归档");
    } else {
      mkdirSync(ARCHIVE_DIR, { recursive: true });

      const now = new Date();
      const ts = now
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const archiveName = `dev_${ts}.db`;
      const archivePath = join(ARCHIVE_DIR, archiveName);

      const stats = statSync(DB_PATH);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`📦 归档数据库 → archives/${archiveName} (${sizeMB} MB)`);
      copyFileSync(DB_PATH, archivePath);
    }

    // 2) 重置数据库
    console.log("🔄 重置数据库...");
    execSync("npx prisma migrate reset --force", {
      cwd: ROOT,
      stdio: "inherit",
      timeout: 30_000,
    });

    // 3) 重新播种
    console.log("🌱 重新播种...");
    execSync("npx tsx prisma/seed.ts", {
      cwd: ROOT,
      stdio: "inherit",
      timeout: 30_000,
    });

    console.log("✅ 归档 & 重置完成");

    return NextResponse.json({
      success: true,
      message: "数据已归档并重置",
    });
  } catch (err) {
    console.error("归档失败:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "归档或重置失败", detail: message },
      { status: 500 }
    );
  }
}
