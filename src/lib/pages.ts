/** 編集画面で挿入する1分ページ区切り（行単独） */
export const MINUTE_PAGE_MARKER = "=== 1分 ===";

const PAGE_DELIMITER = /^\s*===\s*1分\s*===\s*$/;

export const PAGE_DURATION_SEC = 60;

export type ScriptPage = {
  id: string;
  index: number;
  text: string;
};

export function parsePages(raw: string): ScriptPage[] {
  const chunks = raw
    .split(/\r?\n/)
    .reduce<string[][]>((acc, line) => {
      if (PAGE_DELIMITER.test(line)) {
        acc.push([]);
        return acc;
      }
      if (acc.length === 0) acc.push([]);
      acc[acc.length - 1].push(line);
      return acc;
    }, [])
    .map((lines) => lines.join("\n").trim())
    .filter((text) => text.length > 0);

  if (chunks.length === 0 && raw.trim()) {
    chunks.push(raw.trim());
  }

  return chunks.map((text, index) => ({
    id: `page-${index}`,
    index,
    text,
  }));
}

export function pageDurations(pageCount: number): number[] {
  if (pageCount <= 0) return [];
  return Array.from({ length: pageCount }, () => PAGE_DURATION_SEC);
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** 旧形式（---）を1分区切りへ寄せる */
export function migrateScriptDelimiters(script: string): string {
  return script.replace(/^\s*---\s*$/gm, MINUTE_PAGE_MARKER);
}

export function insertMinuteMarkerAt(
  script: string,
  cursorFrom: number,
  cursorTo: number,
): { text: string; selection: number } {
  const before = script.slice(0, cursorFrom);
  const after = script.slice(cursorTo);
  const needsLead = before.length > 0 && !before.endsWith("\n");
  const needsTrail = after.length > 0 && !after.startsWith("\n");
  const block =
    `${needsLead ? "\n" : ""}\n${MINUTE_PAGE_MARKER}\n${needsTrail ? "\n" : ""}`;
  const text = before + block + after;
  const selection = before.length + block.length;
  return { text, selection };
}
