import { NextRequest, NextResponse } from "next/server";
import {
  activateLLMProfile,
  clearLLMSettings,
  deleteLLMProfile,
  getEffectiveLLMSettings,
  getLLMSettingsStore,
  saveLLMProfile,
  validateLLMSettings,
} from "@/lib/llm-settings";

export async function GET() {
  return NextResponse.json({
    ...getLLMSettingsStore(),
    effectiveSettings: getEffectiveLLMSettings(),
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const store = saveLLMProfile(body, body.activate !== false);
    return NextResponse.json({ ...store, effectiveSettings: getEffectiveLLMSettings() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "保存 LLM 设置失败" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const store = activateLLMProfile(body.activeProfileId);
    return NextResponse.json({ ...store, effectiveSettings: getEffectiveLLMSettings() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "切换 LLM 配置失败" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      clearLLMSettings();
      return NextResponse.json({ ...getLLMSettingsStore(), effectiveSettings: getEffectiveLLMSettings() });
    }
    const store = deleteLLMProfile(id);
    return NextResponse.json({ ...store, effectiveSettings: getEffectiveLLMSettings() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "删除 LLM 配置失败" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = validateLLMSettings(body);
    const response = await fetch(`${settings.apiBaseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `连接失败：HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const models = Array.isArray(data?.data) ? data.data.map((item: any) => item.id).filter(Boolean) : [];
    return NextResponse.json({ ok: true, models });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "测试连接失败" }, { status: 400 });
  }
}
