/* Copyright 2026 Marimo. All rights reserved. */

import type { SupportedLocale, SkillTranslationMap } from "./types";
import { en } from "./en";
import { zh } from "./zh";

export type { SupportedLocale, SkillTranslation, SkillTranslationMap } from "./types";

const translations: Record<
  Exclude<SupportedLocale, "ja">,
  SkillTranslationMap
> = { en, zh };

/**
 * ロケール文字列を SupportedLocale に正規化する。
 * - "en-US", "en-GB" → "en"
 * - "zh-CN", "zh-TW" → "zh"
 * - "ja", "ja-JP" → "ja"
 * - 未対応ロケール (例: "ko", "fr") → "en"（国際的フォールバック）
 * - null / undefined → "ja"（デフォルト = 日本語）
 */
export function normalizeLocale(
  locale: string | null | undefined,
): SupportedLocale {
  if (!locale) {
    return "ja";
  }
  const lang = locale.split("-")[0].toLowerCase();
  if (lang === "ja") {
    return "ja";
  }
  if (lang === "en") {
    return "en";
  }
  if (lang === "zh") {
    return "zh";
  }
  return "en";
}

/**
 * "ja" → undefined（翻訳不要、skill-data.ts の値をそのまま使う）
 * "en" / "zh" → 対応する翻訳マップ
 */
export function getTranslationMap(
  locale: SupportedLocale,
): SkillTranslationMap | undefined {
  if (locale === "ja") {
    return undefined;
  }
  return translations[locale];
}
