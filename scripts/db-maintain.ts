/**
 * SQLite 定期维护脚本
 * npm run db:maintain — VACUUM + 索引优化 + 日志清理
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import "dotenv/config";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const adapter = new PrismaLibSql({ url });
  const prisma = new PrismaClient({ adapter });
  console.log("🔧 开始数据库维护...\n");

  // 1. 优化索引统计信息
  console.log("1/4 PRAGMA optimize...");
  await prisma.$executeRawUnsafe("PRAGMA optimize");
  console.log("   ✅ 完成\n");

  // 2. 重建数据库文件，回收碎片空间
  console.log("2/4 VACUUM...");
  await prisma.$executeRawUnsafe("VACUUM");
  console.log("   ✅ 完成\n");

  // 3. 清理 90 天前的操作日志
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  console.log(`3/4 清理 ${ninetyDaysAgo.toISOString().slice(0, 10)} 之前的操作日志...`);
  const { count } = await prisma.systemLog.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });
  console.log(`   ✅ 已清理 ${count} 条\n`);

  // 4. 记录维护时间
  console.log("4/4 记录维护时间...");
  await prisma.systemLog.create({
    data: {
      action: "system.maintenance",
      targetType: "System",
      detail: JSON.stringify({ maintainedAt: new Date().toISOString() }),
    },
  });
  console.log("   ✅ 完成\n");

  console.log("🎉 数据库维护完成！");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ 维护失败:", err);
  process.exit(1);
});
