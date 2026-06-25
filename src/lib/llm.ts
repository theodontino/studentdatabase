import OpenAI from "openai";
import { getEffectiveLLMSettings } from "./llm-settings";

/** Creates the configured OpenAI-compatible client and fails fast without a key. */
export function createLLMClient() {
  const { apiKey, apiBaseUrl } = getEffectiveLLMSettings();

  if (!apiKey) {
    throw new Error("LLM API Key 未设置，请在系统设置中配置");
  }

  return new OpenAI({
    apiKey,
    baseURL: apiBaseUrl,
  });
}

/** Returns the configured model name without performing a network request. */
export function getLLMModel(): string {
  return getEffectiveLLMSettings().model;
}
