/**
 * 归档当前数据库 + 重置数据库
 *
 * 用法: npm run db:archive
 *
 * 流程:
 *   1. 复制 dev.db → archives/dev_<timestamp>.db
 *   2. prisma migrate reset --force (清空 + 重建表)
 *   3. 重新播种
 */

import { execSync } from "child_process";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
// Note: seed.ts uses @prisma/adapter-libsql which resolves DATABASE_URL
// relative to CWD, so dev.db lives at the project root, not prisma/.
const DB_PATH = join(ROOT, "dev.db");
const ARCHIVE_DIR = join(ROOT, "archives");

// 1) 检查数据库文件是否存在
if (!existsSync(DB_PATH)) {
  console.log("⚠️  dev.db 不存在，跳过归档，直接重建...\n");
} else {
  // 2) 创建归档目录
  mkdirSync(ARCHIVE_DIR, { recursive: true });

  // 3) 生成时间戳文件名
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19); // "2026-06-04T10-30-00"
  const archiveName = `dev_${ts}.db`;
  const archivePath = join(ARCHIVE_DIR, archiveName);

  // 4) 复制数据库文件
  const stats = existsSync(DB_PATH) ? require("fs").statSync(DB_PATH) : null;
  const sizeMB = stats ? (stats.size / (1024 * 1024)).toFixed(2) : "?";

  console.log(`📦 归档数据库 → archives/${archiveName}`);
  copyFileSync(DB_PATH, archivePath);
  console.log(`   大小: ${sizeMB} MB\n`);
}

// 5) 重置数据库
console.log("🔄 重置数据库...");
execSync("npx prisma migrate reset --force", {
  cwd: ROOT,
  stdio: "inherit",
});

// 6) 重新播种
console.log("\n🌱 重新播种...");
execSync("npx tsx prisma/seed.ts", {
  cwd: ROOT,
  stdio: "inherit",
});

console.log("\n✅ 归档 & 重置完成！");
console.log(`   归档位置: archives/`);
