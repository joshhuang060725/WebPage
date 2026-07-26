import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Language = "en" | "zh-TW" | "zh-CN";
export type Localized = Record<Language, string>;

export const languages: Language[] = ["en", "zh-TW", "zh-CN"];

export function readData<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), "data", name), "utf8")) as T;
}

export function localized(value: Localized | string | undefined, lang: Language = "en") {
  if (!value) return "";
  return typeof value === "string" ? value : value[lang] || value.en || "";
}

export const maturity = {
  ready: { en: "Ready", "zh-TW": "可用", "zh-CN": "可用" },
  beta: { en: "Beta", "zh-TW": "測試版", "zh-CN": "测试版" },
  concept: { en: "Concept", "zh-TW": "概念", "zh-CN": "概念" }
} satisfies Record<string, Localized>;

export function normalizeMaturity(status = ""): keyof typeof maturity {
  if (["ready", "active", "open"].includes(status)) return "ready";
  if (["beta", "experimental"].includes(status)) return "beta";
  return "concept";
}
