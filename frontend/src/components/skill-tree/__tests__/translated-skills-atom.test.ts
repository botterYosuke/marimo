/* Copyright 2026 Marimo. All rights reserved. */

import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import {
  translatedSkillsAtom,
  skillsWithStatusAtom,
} from "../atoms";
import { userConfigAtom } from "@/core/config/config";
import { en } from "../i18n/en";
import { zh } from "../i18n/zh";

/**
 * localeAtom は resolvedMarimoConfigAtom.display.locale から派生し、
 * resolvedMarimoConfigAtom は userConfigAtom から派生する。
 * テストでは userConfigAtom（書き込み可能）を上書きしてロケールを制御する。
 */
function setLocale(store: ReturnType<typeof createStore>, locale: string | null | undefined) {
  const current = store.get(userConfigAtom);
  store.set(userConfigAtom, {
    ...current,
    display: {
      ...current.display,
      locale: locale ?? null,
    },
  });
}

describe("translatedSkillsAtom", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("localeAtom が null の場合、日本語のまま返す", () => {
    setLocale(store, null);
    const translated = store.get(translatedSkillsAtom);
    const original = store.get(skillsWithStatusAtom);

    const sandbox001T = translated.find((s) => s.id === "SANDBOX_001");
    const sandbox001O = original.find((s) => s.id === "SANDBOX_001");
    expect(sandbox001T?.title).toBe(sandbox001O?.title);
    expect(sandbox001T?.description).toBe(sandbox001O?.description);
  });

  it("localeAtom が 'en' の場合、英語タイトルを返す", () => {
    setLocale(store, "en");
    const translated = store.get(translatedSkillsAtom);

    const sandbox001 = translated.find((s) => s.id === "SANDBOX_001");
    expect(sandbox001?.title).toBe(en.skills.SANDBOX_001.title);
    expect(sandbox001?.description).toBe(en.skills.SANDBOX_001.description);
  });

  it("localeAtom が 'en-US' の場合、英語タイトルを返す", () => {
    setLocale(store, "en-US");
    const translated = store.get(translatedSkillsAtom);

    const sandbox001 = translated.find((s) => s.id === "SANDBOX_001");
    expect(sandbox001?.title).toBe(en.skills.SANDBOX_001.title);
  });

  it("localeAtom が 'zh-CN' の場合、中国語タイトルを返す", () => {
    setLocale(store, "zh-CN");
    const translated = store.get(translatedSkillsAtom);

    const sandbox001 = translated.find((s) => s.id === "SANDBOX_001");
    expect(sandbox001?.title).toBe(zh.skills.SANDBOX_001.title);
    expect(sandbox001?.description).toBe(zh.skills.SANDBOX_001.description);
  });

  it("翻訳対象外のフィールド(id, status, category, reward)は変更されない", () => {
    setLocale(store, "en");
    const translated = store.get(translatedSkillsAtom);
    const original = store.get(skillsWithStatusAtom);

    const sandbox001T = translated.find((s) => s.id === "SANDBOX_001");
    const sandbox001O = original.find((s) => s.id === "SANDBOX_001");

    expect(sandbox001T?.id).toBe(sandbox001O?.id);
    expect(sandbox001T?.status).toBe(sandbox001O?.status);
    expect(sandbox001T?.category).toBe(sandbox001O?.category);
    expect(sandbox001T?.reward).toEqual(sandbox001O?.reward);
    expect(sandbox001T?.prerequisites).toEqual(sandbox001O?.prerequisites);
    expect(sandbox001T?.difficulty).toBe(sandbox001O?.difficulty);
    expect(sandbox001T?.helpContent).toBe(sandbox001O?.helpContent);
  });

  it("全59スキルが翻訳される", () => {
    setLocale(store, "en");
    const translated = store.get(translatedSkillsAtom);

    expect(translated).toHaveLength(59);

    for (const skill of translated) {
      const enTranslation = en.skills[skill.id];
      expect(skill.title).toBe(enTranslation.title);
      expect(skill.description).toBe(enTranslation.description);
    }
  });
});
