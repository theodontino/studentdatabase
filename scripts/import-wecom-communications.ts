import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  applyWeComCommunicationImport,
  planWeComCommunicationImport,
} from "../src/services/wecom-import-service";

interface Args {
  jsonPath: string;
  apply: boolean;
  includeMedium: boolean;
  skipBackup: boolean;
}

function usage() {
  return [
    "用法:",
    "  npm run import:wecom -- <json-path> [--apply] [--include-medium] [--skip-backup]",
    "",
    "默认 dry-run，只预览可导入记录；加 --apply 才写入 Communication。",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const jsonPath = positional[0];
  if (!jsonPath) throw new Error(usage());
  return {
    jsonPath,
    apply: argv.includes("--apply"),
    includeMedium: argv.includes("--include-medium"),
    skipBackup: argv.includes("--skip-backup"),
  };
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adapter = new PrismaLibSql({ url: requireDatabaseUrl() });
  const prisma = new PrismaClient({ adapter });

  try {
    const result = args.apply
      ? await applyWeComCommunicationImport(prisma, args)
      : await planWeComCommunicationImport(prisma, args);

    console.log(`文件: ${result.sourceLabel}`);
    console.log(`模式: ${result.mode === "apply" ? "写入" : "dry-run 预览"}`);
    console.log(`communication 候选: ${result.communicationCandidateCount}`);
    console.log(`AI 上下文候选（暂不入库）: ${result.aiContextCandidateCount}`);
    console.log(`可匹配并可入库: ${result.importableCount}`);
    console.log(`将新增: ${result.createCount}`);
    console.log(`重复跳过: ${result.duplicateCount}`);
    console.log(`不可导入: ${result.skippedCount}`);

    if (result.backupPath) console.log(`\n写入前备份: ${result.backupPath}`);
    if (result.plans.length > 0) {
      console.log("\n可导入预览:");
      for (const plan of result.plans) {
        console.log(`- ${plan.duplicate ? "[重复] " : ""}${plan.student.name}(${plan.student.studentId}) -> ${plan.session.code} ${plan.binding} / ${plan.target}`);
        console.log(`  ${plan.summary}`);
      }
    }

    if (result.skipped.length > 0) {
      console.log("\n跳过项:");
      for (const item of result.skipped) {
        console.log(`- ${item.name || "未知学生"} / ${item.title || "未知会话"}: ${item.reason}`);
      }
    }

    if (args.apply) {
      console.log(`\n已写入 ${result.createdCount} 条家校沟通记录。`);
    } else {
      console.log("\n未写入数据库。确认无误后运行同一命令并追加 --apply。");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
