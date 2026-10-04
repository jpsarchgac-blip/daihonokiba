"use client";

import type { DaihonSettings, PreviewFontFamily } from "@/lib/storage";

type Props = {
  settings: Pick<
    DaihonSettings,
    "previewFontSizePx" | "previewLineHeight" | "previewFontFamily"
  >;
  onChange: (patch: Partial<DaihonSettings>) => void;
  compact?: boolean;
};

export function PreviewControls({ settings, onChange, compact }: Props) {
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <label className="block text-sm text-app-muted">
        文字サイズ（{settings.previewFontSizePx}px）
        <input
          type="range"
          min={14}
          max={56}
          step={1}
          value={settings.previewFontSizePx}
          onChange={(e) =>
            onChange({ previewFontSizePx: Number(e.target.value) })
          }
          className="mt-2 w-full accent-emerald-500"
        />
      </label>
      <label className="block text-sm text-app-muted">
        行間（{settings.previewLineHeight.toFixed(2)}）
        <input
          type="range"
          min={1.15}
          max={2.2}
          step={0.05}
          value={settings.previewLineHeight}
          onChange={(e) =>
            onChange({ previewLineHeight: Number(e.target.value) })
          }
          className="mt-2 w-full accent-emerald-500"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm text-app-muted">フォント</legend>
        {(
          [
            ["sans", "ゴシック"],
            ["serif", "明朝"],
            ["mono", "等幅"],
          ] as [PreviewFontFamily, string][]
        ).map(([id, label]) => (
          <label
            key={id}
            className="flex cursor-pointer items-center gap-2 text-sm text-app-fg"
          >
            <input
              type="radio"
              name="preview-font"
              checked={settings.previewFontFamily === id}
              onChange={() => onChange({ previewFontFamily: id })}
              className="accent-emerald-500"
            />
            {label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
