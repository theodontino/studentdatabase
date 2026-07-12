export type LocalToolAvailability = "available" | "warning" | "unavailable";

export interface LocalToolCheck {
  id: string;
  label: string;
  status: LocalToolAvailability;
  detail: string;
  path?: string;
}

export interface LocalToolStatus {
  id: "funasr" | "wecomcatch";
  name: string;
  status: LocalToolAvailability;
  summary: string;
  checks: LocalToolCheck[];
  notice?: string;
}

export interface LocalToolsStatusResponse {
  checkedAt: string;
  tools: LocalToolStatus[];
}

export interface LocalToolPreflight {
  ready: boolean;
  blockers: string[];
}
