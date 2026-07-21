import { readFile } from "node:fs/promises";
import path from "node:path";
import { Badge, PageHeader, Section, StatusBanner } from "@/components/ui";

export default async function LicensePanel() {
  const licenseText = await readFile(path.join(process.cwd(), "LICENSE"), "utf8");
  return <main className="system-license-workspace">
    <PageHeader title="开源许可" description="Chem-Track AI 的软件许可与数据边界。" actions={<Badge tone="info">AGPL-3.0-only</Badge>} />
    <StatusBanner tone="warning">许可证只覆盖本项目的软件和文档，不授予任何学生数据、聊天记录、音频、日志或导出内容的公开权限。</StatusBanner>
    <Section title="GNU Affero General Public License v3.0 only" description="以下文本直接读取项目根目录的 LICENSE 文件。">
      <pre className="system-license-text">{licenseText}</pre>
    </Section>
  </main>;
}
