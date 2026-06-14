import "dotenv/config";
import { createDatabaseBackup } from "../src/services/database-backup-service";

async function main() {
  const result = await createDatabaseBackup();
  console.log(`备份完成: ${result.backupPath}`);
  console.log(`SHA-256: ${result.manifest.sha256}`);
  console.log(`学生数: ${result.manifest.verification.rowCounts.Student}`);
}

main().catch((error) => {
  console.error("备份失败:", error);
  process.exitCode = 1;
});
