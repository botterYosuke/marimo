/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import { normalizeLocale, getTranslationMap } from "../i18n";
import { en } from "../i18n/en";
import { zh } from "../i18n/zh";
import { skillDefinitions } from "../skill-data";

describe("normalizeLocale", () => {
  it('"en-US" → "en"', () => {
    expect(normalizeLocale("en-US")).toBe("en");
  });

  it('"en-GB" → "en"', () => {
    expect(normalizeLocale("en-GB")).toBe("en");
  });

  it('"zh-CN" → "zh"', () => {
    expect(normalizeLocale("zh-CN")).toBe("zh");
  });

  it('"zh-TW" → "zh"', () => {
    expect(normalizeLocale("zh-TW")).toBe("zh");
  });

  it('"ja" → "ja"', () => {
    expect(normalizeLocale("ja")).toBe("ja");
  });

  it('"ja-JP" → "ja"', () => {
    expect(normalizeLocale("ja-JP")).toBe("ja");
  });

  it('null → "ja"', () => {
    expect(normalizeLocale(null)).toBe("ja");
  });

  it('undefined → "ja"', () => {
    expect(normalizeLocale(undefined)).toBe("ja");
  });

  it('"ko" → "en" (未対応 → 英語フォールバック)', () => {
    expect(normalizeLocale("ko")).toBe("en");
  });

  it('"fr" → "en"', () => {
    expect(normalizeLocale("fr")).toBe("en");
  });
});

describe("getTranslationMap", () => {
  it('"ja" → undefined', () => {
    expect(getTranslationMap("ja")).toBeUndefined();
  });

  it('"en" → 59エントリのマップ', () => {
    const map = getTranslationMap("en");
    expect(map).toBeDefined();
    expect(Object.keys(map!.skills)).toHaveLength(59);
  });

  it('"zh" → 59エントリのマップ', () => {
    const map = getTranslationMap("zh");
    expect(map).toBeDefined();
    expect(Object.keys(map!.skills)).toHaveLength(59);
  });
});

describe("翻訳の完全性", () => {
  const allSkillIds = skillDefinitions.map((s) => s.id);

  it("en翻訳に全59スキルIDが存在する", () => {
    for (const id of allSkillIds) {
      expect(en.skills[id]).toBeDefined();
    }
  });

  it("zh翻訳に全59スキルIDが存在する", () => {
    for (const id of allSkillIds) {
      expect(zh.skills[id]).toBeDefined();
    }
  });

  it("en翻訳に空のtitleが存在しない", () => {
    for (const [id, t] of Object.entries(en.skills)) {
      expect(t.title, `${id} has empty title`).not.toBe("");
    }
  });

  it("en翻訳に空のdescriptionが存在しない", () => {
    for (const [id, t] of Object.entries(en.skills)) {
      expect(t.description, `${id} has empty description`).not.toBe("");
    }
  });

  it("zh翻訳に空のtitleが存在しない", () => {
    for (const [id, t] of Object.entries(zh.skills)) {
      expect(t.title, `${id} has empty title`).not.toBe("");
    }
  });

  it("zh翻訳に空のdescriptionが存在しない", () => {
    for (const [id, t] of Object.entries(zh.skills)) {
      expect(t.description, `${id} has empty description`).not.toBe("");
    }
  });

  it("en翻訳に余分なスキルIDが存在しない", () => {
    const enIds = Object.keys(en.skills);
    for (const id of enIds) {
      expect(allSkillIds).toContain(id);
    }
  });

  it("zh翻訳に余分なスキルIDが存在しない", () => {
    const zhIds = Object.keys(zh.skills);
    for (const id of zhIds) {
      expect(allSkillIds).toContain(id);
    }
  });
});
