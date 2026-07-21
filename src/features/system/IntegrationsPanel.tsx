import LocalToolStatusPanel from "@/components/system/LocalToolStatusPanel";
import { PageHeader } from "@/components/ui";
import WeComAccessPanel from "@/features/wecom/WeComAccessPanel";

export default function IntegrationsPanel() {
  return <main className="system-integrations-workspace"><PageHeader title="集成与本地工具" description="检查 WeComCatch、FunASR 及本机依赖，启用可选的第三方工具入口。" /><LocalToolStatusPanel /><div id="wecom-access" className="system-integration-anchor"><WeComAccessPanel /></div></main>;
}
