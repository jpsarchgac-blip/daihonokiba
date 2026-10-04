import { migrateScriptDelimiters } from "./pages";

export type ColorMode = "dark" | "light";
export type PreviewFontFamily = "sans" | "serif" | "mono";

export type DaihonSettings = {
  script: string;
  speechAssist: boolean;
  autoAdvanceOnRead: boolean;
  colorMode: ColorMode;
  previewFontSizePx: number;
  previewLineHeight: number;
  previewFontFamily: PreviewFontFamily;
};

const STORAGE_KEY = "daihon-oki-settings-v3";

const DEFAULT_SCRIPT = `はじめに
本日はお集まりいただきありがとうございます。
このあと1分ごとにページが進みます。

=== 1分 ===

課題
現状、台本と時間配分の管理がバラバラです。
発表直前まで調整に時間が取られています。

=== 1分 ===

解決策
1分区切りを入れるだけで、発表中は1分ごとに次のページへ進みます。

=== 1分 ===

まとめ
ご清聴ありがとうございました。
質疑応答に進みます。`;

export const defaultSettings: DaihonSettings = {
  script: DEFAULT_SCRIPT,
  speechAssist: false,
  autoAdvanceOnRead: false,
  colorMode: "dark",
  previewFontSizePx: 28,
  previewLineHeight: 1.55,
  previewFontFamily: "sans",
};

export function loadSettings(): DaihonSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem("daihon-oki-settings-v2") ??
      localStorage.getItem("daihon-oki-settings-v1");
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<DaihonSettings>;
    const script = migrateScriptDelimiters(
      parsed.script ?? defaultSettings.script,
    );
    return {
      script,
      speechAssist: parsed.speechAssist ?? defaultSettings.speechAssist,
      autoAdvanceOnRead:
        parsed.autoAdvanceOnRead ?? defaultSettings.autoAdvanceOnRead,
      colorMode: parsed.colorMode === "light" ? "light" : "dark",
      previewFontSizePx: clampNum(
        parsed.previewFontSizePx ?? defaultSettings.previewFontSizePx,
        14,
        56,
      ),
      previewLineHeight: clampNum(
        parsed.previewLineHeight ?? defaultSettings.previewLineHeight,
        1.15,
        2.2,
      ),
      previewFontFamily:
        parsed.previewFontFamily ?? defaultSettings.previewFontFamily,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: DaihonSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyColorModeToDocument(mode: ColorMode): void {
  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light");
  root.classList.add(mode === "light" ? "theme-light" : "theme-dark");
}

function clampNum(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
