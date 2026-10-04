import {
  defaultSettings,
  type DaihonSettings,
  type PreviewFontFamily,
  type ColorMode,
} from "./storage";

export const EXPORT_FORMAT_VERSION = 1;

export type DaihonExportFile = {
  format: "daihon-oki";
  version: number;
  exportedAt: string;
  settings: DaihonSettings;
};

export function buildExportPayload(settings: DaihonSettings): DaihonExportFile {
  return {
    format: "daihon-oki",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
  };
}

export function serializeExport(settings: DaihonSettings): string {
  return JSON.stringify(buildExportPayload(settings), null, 2);
}

export function parseImport(raw: string): DaihonSettings {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("空のファイルです");

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { ...defaultSettings, script: trimmed };
  }

  if (typeof data === "object" && data !== null && "settings" in data) {
    return normalizeSettings((data as DaihonExportFile).settings);
  }

  if (typeof data === "object" && data !== null && "script" in data) {
    return normalizeSettings(data as Partial<DaihonSettings>);
  }

  throw new Error("対応していないファイル形式です");
}

function normalizeSettings(partial: Partial<DaihonSettings>): DaihonSettings {
  const colorMode: ColorMode =
    partial.colorMode === "light" ? "light" : "dark";
  const fontFamily: PreviewFontFamily =
    partial.previewFontFamily === "serif" ||
    partial.previewFontFamily === "mono"
      ? partial.previewFontFamily
      : "sans";

  return {
    script: partial.script ?? defaultSettings.script,
    speechAssist: partial.speechAssist ?? defaultSettings.speechAssist,
    autoAdvanceOnRead:
      partial.autoAdvanceOnRead ?? defaultSettings.autoAdvanceOnRead,
    colorMode,
    previewFontSizePx: clamp(
      partial.previewFontSizePx ?? defaultSettings.previewFontSizePx,
      14,
      56,
    ),
    previewLineHeight: clamp(
      partial.previewLineHeight ?? defaultSettings.previewLineHeight,
      1.15,
      2.2,
    ),
    previewFontFamily: fontFamily,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "application/json;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
