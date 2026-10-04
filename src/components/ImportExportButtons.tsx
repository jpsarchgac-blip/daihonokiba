"use client";

import { useRef } from "react";
import {
  downloadTextFile,
  parseImport,
  serializeExport,
} from "@/lib/importExport";
import type { DaihonSettings } from "@/lib/storage";

type Props = {
  settings: DaihonSettings;
  onImport: (settings: DaihonSettings) => void;
};

export function ImportExportButtons({ settings, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`台本おき-${stamp}.json`, serializeExport(settings));
  };

  const exportTxt = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `台本おき-${stamp}.txt`,
      settings.script,
      "text/plain;charset=utf-8",
    );
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    try {
      onImport(parseImport(text));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "インポートに失敗しました";
      window.alert(msg);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={exportJson}
        className="app-btn-secondary w-full text-sm"
      >
        設定をエクスポート（JSON）
      </button>
      <button
        type="button"
        onClick={exportTxt}
        className="app-btn-secondary w-full text-sm"
      >
        原稿のみエクスポート（TXT）
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="app-btn-secondary w-full text-sm"
      >
        インポート（JSON / TXT）
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.txt,text/plain,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-app-muted">
        JSON は設定ごと、TXT は原稿のみ読み込みます。
      </p>
    </div>
  );
}
