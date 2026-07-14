"use client";

import { Badge, Button, EmptyState, LoadingState, Section } from "@/components/ui";
import type { useLLMConfiguration } from "./useLLMConfiguration";

type Workspace = ReturnType<typeof useLLMConfiguration>;

export function LLMProfileList({ workspace }: { workspace: Workspace }) {
  return (
    <Section title="已保存配置" description="选择一个配置进行查看或编辑。" actions={<Button uiSize="sm" variant="secondary" onClick={workspace.newProfile}>新增</Button>}>
      <div className="llm-profile-list">
        {workspace.loading ? <LoadingState label="读取配置中…" /> : workspace.profiles.length === 0 ? <EmptyState title="还没有保存的配置" description="填写右侧信息后保存即可建立第一个配置。" /> : workspace.profiles.map((profile) => {
          const selected = profile.id === workspace.selectedProfileId;
          const active = profile.id === workspace.activeProfileId;
          return <button key={profile.id} type="button" className={selected ? "is-selected" : ""} onClick={() => workspace.selectProfile(profile)}><span><strong>{profile.name}</strong>{active && <Badge tone="success">启用</Badge>}</span><small>{profile.model || "尚未指定模型"}</small></button>;
        })}
      </div>
    </Section>
  );
}
