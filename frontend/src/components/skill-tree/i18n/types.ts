/* Copyright 2026 Marimo. All rights reserved. */

export type SupportedLocale = "ja" | "en" | "zh";

export interface SkillTranslation {
  title: string;
  description: string;
}

export interface SkillTranslationMap {
  skills: Record<string, SkillTranslation>;
}
