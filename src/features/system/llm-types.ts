export interface LLMProfile {
  id: string;
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface LLMSettingsResponse {
  activeProfileId: string | null;
  profiles: LLMProfile[];
  effectiveSettings: {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    updatedAt?: string;
  };
}

export type LLMProfileForm = Partial<LLMProfile> & {
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
};

export const EMPTY_LLM_PROFILE: LLMProfileForm = {
  name: "LM Studio",
  apiBaseUrl: "http://localhost:1234/v1",
  apiKey: "lm-studio",
  model: "",
};
