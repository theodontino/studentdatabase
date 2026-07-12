import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

interface Finding { path: string; rule: string; }

const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const findings: Finding[] = [];
const forbiddenNames = [
  /(^|\/)\.env$/,
  /\.(db|sqlite|sqlite3)$/i,
  /(^|\/)(archives|runtime|data|exports|diagnostics|local-backups)\//i,
  /(^|\/)config\.local\.json$/i,
  /(^|\/)\.DS_Store$/,
  /\.(pem|p12|pfx)$/i,
];

const slash = "/";
const contentRules: Array<[string, RegExp]> = [
  ["personal macOS home path", new RegExp(`${slash}Users${slash}(?!username(?:${slash}|$)|example(?:${slash}|$)|your-name(?:${slash}|$))[A-Za-z0-9._-]+${slash}`)],
  ["personal Linux home path", new RegExp(`${slash}home${slash}(?!username(?:${slash}|$)|example(?:${slash}|$)|your-name(?:${slash}|$))[A-Za-z0-9._-]+${slash}`)],
  ["private key", new RegExp(["-----BEGIN ", "PRIVATE KEY-----"].join("(?:RSA |EC |OPENSSH )?"))],
  ["GitHub token", new RegExp(["gh", "p_[A-Za-z0-9]{20,}"].join(""))],
  ["GitHub fine-grained token", new RegExp(["github", "_pat_[A-Za-z0-9_]{20,}"].join(""))],
  ["OpenAI-style key", new RegExp(`\\b${["s", "k-"].join("")}[A-Za-z0-9_-]{20,}\\b`)],
  ["AWS access key", new RegExp(`\\b${["AK", "IA"].join("")}[0-9A-Z]{16}\\b`)],
  ["mainland China phone-like value", /\b1[3-9][0-9]{9}\b/],
];

for (const path of tracked) {
  for (const pattern of forbiddenNames) if (pattern.test(path)) findings.push({ path, rule: "forbidden tracked artifact" });
  let stat;
  try { stat = statSync(path); } catch { continue; }
  if (!stat.isFile() || stat.size > 2_000_000) continue;
  const content = readFileSync(path, "utf8");
  for (const [rule, pattern] of contentRules) {
    if (path === ".env.example" && rule === "OpenAI-style key") continue;
    if (pattern.test(content)) findings.push({ path, rule });
  }
  if (/HANDOFF|交接/.test(basename(path)) && /运行状态|current status|当前数据库状态/i.test(content)) {
    findings.push({ path, rule: "runtime handoff document" });
  }
}

if (findings.length) {
  console.error("隐私检查失败：");
  for (const finding of findings) console.error(`- ${finding.path}: ${finding.rule}`);
  process.exit(1);
}
console.log(`隐私检查通过：已检查 ${tracked.length} 个 Git 跟踪文件。`);
