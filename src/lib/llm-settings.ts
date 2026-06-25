import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface LLMSettings {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  updatedAt?: string;
}

export interface LLMProfile extends LLMSettings {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LLMSettingsStore {
  activeProfileId: string | null;
  profiles: LLMProfile[];
}

const DEFAULT_API_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

function settingsPath() {
  return process.env.LLM_SETTINGS_PATH || path.join(process.cwd(), "data", "llm-settings.json");
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSettings(input: Partial<LLMSettings>): LLMSettings {
  return {
    apiBaseUrl: (input.apiBaseUrl || "").trim(),
    apiKey: (input.apiKey || "").trim(),
    model: (input.model || "").trim(),
    updatedAt: input.updatedAt,
  };
}

function normalizeProfile(input: Partial<LLMProfile>, fallbackName = "默认配置"): LLMProfile {
  const timestamp = nowIso();
  const settings = normalizeSettings(input);
  return {
    id: input.id || randomUUID(),
    name: (input.name || fallbackName).trim(),
    apiBaseUrl: settings.apiBaseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  };
}

function emptyStore(): LLMSettingsStore {
  return { activeProfileId: null, profiles: [] };
}

function parseStore(raw: any): LLMSettingsStore {
  if (Array.isArray(raw?.profiles)) {
    const profiles: LLMProfile[] = raw.profiles
      .map((profile: any, index: number) => normalizeProfile(profile, `配置 ${index + 1}`))
      .filter((profile: LLMProfile) => profile.apiBaseUrl || profile.apiKey || profile.model);
    const activeProfileId = profiles.some((profile) => profile.id === raw.activeProfileId)
      ? raw.activeProfileId
      : profiles[0]?.id ?? null;
    return { activeProfileId, profiles };
  }

  // Backward compatible with the previous single-profile JSON shape.
  const legacy = normalizeSettings(raw || {});
  if (!legacy.apiBaseUrl && !legacy.apiKey && !legacy.model) return emptyStore();
  const profile = normalizeProfile({ ...legacy, id: "default", name: "默认配置" });
  return { activeProfileId: profile.id, profiles: [profile] };
}

function readStore(): LLMSettingsStore {
  const filePath = settingsPath();
  if (!fs.existsSync(filePath)) return emptyStore();

  try {
    return parseStore(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch (error) {
    console.error("[llm-settings] failed to read settings:", error);
    return emptyStore();
  }
}

function writeStore(store: LLMSettingsStore) {
  const filePath = settingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function getLLMSettingsStore(): LLMSettingsStore {
  return readStore();
}

/** Returns the effective LLM settings, using the active Web UI profile before .env values. */
export function getEffectiveLLMSettings(): LLMSettings {
  const store = readStore();
  const activeProfile = store.profiles.find((profile) => profile.id === store.activeProfileId);
  return {
    apiBaseUrl: activeProfile?.apiBaseUrl || process.env.LLM_API_BASE_URL || DEFAULT_API_BASE_URL,
    apiKey: activeProfile?.apiKey || process.env.LLM_API_KEY || "",
    model: activeProfile?.model || process.env.LLM_MODEL || DEFAULT_MODEL,
    updatedAt: activeProfile?.updatedAt,
  };
}

export function validateLLMSettings(input: Partial<LLMSettings>): LLMSettings {
  const settings = normalizeSettings(input);
  if (!settings.apiBaseUrl) throw new Error("请填写 API Base URL");
  if (!settings.apiKey) throw new Error("请填写 API Key");
  if (!settings.model) throw new Error("请填写模型名");

  try {
    const url = new URL(settings.apiBaseUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("API Base URL 必须是有效的 http/https 地址");
  }

  return settings;
}

export function saveLLMProfile(input: Partial<LLMProfile>, activate = true): LLMSettingsStore {
  const settings = validateLLMSettings(input);
  const name = (input.name || "").trim();
  if (!name) throw new Error("请填写配置名称");

  const store = readStore();
  const existingIndex = input.id ? store.profiles.findIndex((profile) => profile.id === input.id) : -1;
  const previous = existingIndex >= 0 ? store.profiles[existingIndex] : null;
  const profile: LLMProfile = {
    id: previous?.id || input.id || randomUUID(),
    name,
    apiBaseUrl: settings.apiBaseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    createdAt: previous?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  if (existingIndex >= 0) store.profiles[existingIndex] = profile;
  else store.profiles.push(profile);
  if (activate || !store.activeProfileId) store.activeProfileId = profile.id;

  writeStore(store);
  return store;
}

export function activateLLMProfile(profileId: string): LLMSettingsStore {
  const store = readStore();
  if (!store.profiles.some((profile) => profile.id === profileId)) throw new Error("配置不存在");
  store.activeProfileId = profileId;
  writeStore(store);
  return store;
}

export function deleteLLMProfile(profileId: string): LLMSettingsStore {
  const store = readStore();
  const nextProfiles = store.profiles.filter((profile) => profile.id !== profileId);
  if (nextProfiles.length === store.profiles.length) throw new Error("配置不存在");
  store.profiles = nextProfiles;
  if (store.activeProfileId === profileId) store.activeProfileId = store.profiles[0]?.id ?? null;
  writeStore(store);
  return store;
}

export function clearLLMSettings() {
  const filePath = settingsPath();
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
