import "dotenv/config";
import { resolve } from "node:path";
import { restoreDatabaseBackup } from "../src/services/database-backup-service";

async function main() {
  const argument = process.argv[2];
  if (!argument) throw new Error("用法: npm run db:restore -- archives/<backup>.db");

  const result = await restoreDatabaseBackup({ backupPath: resolve(argument) });
  console.log(`恢复完成: ${result.restoredManifest.databaseFile}`);
  console.log(`恢复前备份: ${result.preRestore.backupPath}`);
  console.log("请重新启动应用。");
}

main().catch((error) => {
  console.error("恢复失败:", error);
  process.exitCode = 1;
});
