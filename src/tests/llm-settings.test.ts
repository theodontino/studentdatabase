import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activateLLMProfile,
  clearLLMSettings,
  getEffectiveLLMSettings,
  getLLMSettingsStore,
  saveLLMProfile,
  validateLLMSettings,
} from "@/lib/llm-settings";

let tempDir = "";
const originalEnv = {
  LLM_SETTINGS_PATH: process.env.LLM_SETTINGS_PATH,
  LLM_API_BASE_URL: process.env.LLM_API_BASE_URL,
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_MODEL: process.env.LLM_MODEL,
};

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chem-track-llm-settings-"));
  process.env.LLM_SETTINGS_PATH = path.join(tempDir, "settings.json");
  process.env.LLM_API_BASE_URL = "https://env.example/v1";
  process.env.LLM_API_KEY = "env-key";
  process.env.LLM_MODEL = "env-model";
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.env.LLM_SETTINGS_PATH = originalEnv.LLM_SETTINGS_PATH;
  process.env.LLM_API_BASE_URL = originalEnv.LLM_API_BASE_URL;
  process.env.LLM_API_KEY = originalEnv.LLM_API_KEY;
  process.env.LLM_MODEL = originalEnv.LLM_MODEL;
});

describe("llm-settings", () => {
  it("uses active Web UI profile before environment values", () => {
    saveLLMProfile({
      name: "Local",
      apiBaseUrl: "http://localhost:1234/v1",
      apiKey: "lm-studio",
      model: "local-model",
    });

    expect(getEffectiveLLMSettings()).toMatchObject({
      apiBaseUrl: "http://localhost:1234/v1",
      apiKey: "lm-studio",
      model: "local-model",
    });
  });

  it("falls back to environment values after clearing saved settings", () => {
    saveLLMProfile({
      name: "Local",
      apiBaseUrl: "http://localhost:1234/v1",
      apiKey: "lm-studio",
      model: "local-model",
    });
    clearLLMSettings();

    expect(getEffectiveLLMSettings()).toMatchObject({
      apiBaseUrl: "https://env.example/v1",
      apiKey: "env-key",
      model: "env-model",
    });
  });

  it("saves multiple profiles and switches the active one", () => {
    saveLLMProfile({
      name: "Local",
      apiBaseUrl: "http://localhost:1234/v1",
      apiKey: "lm-studio",
      model: "local-model",
    });
    const store = saveLLMProfile({
      name: "Cloud",
      apiBaseUrl: "https://api.example/v1",
      apiKey: "cloud-key",
      model: "cloud-model",
    }, false);

    expect(store.profiles).toHaveLength(2);
    expect(getEffectiveLLMSettings().model).toBe("local-model");

    const cloud = getLLMSettingsStore().profiles.find((profile) => profile.name === "Cloud");
    activateLLMProfile(cloud!.id);

    expect(getEffectiveLLMSettings()).toMatchObject({
      apiBaseUrl: "https://api.example/v1",
      apiKey: "cloud-key",
      model: "cloud-model",
    });
  });

  it("rejects incomplete or invalid settings", () => {
    expect(() => validateLLMSettings({ apiBaseUrl: "localhost:1234", apiKey: "x", model: "m" })).toThrow("http/https");
    expect(() => validateLLMSettings({ apiBaseUrl: "http://localhost:1234/v1", apiKey: "", model: "m" })).toThrow("API Key");
    expect(() => validateLLMSettings({ apiBaseUrl: "http://localhost:1234/v1", apiKey: "x", model: "" })).toThrow("模型名");
  });
});
