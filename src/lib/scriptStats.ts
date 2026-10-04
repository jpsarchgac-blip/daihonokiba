export type ScriptCounts = {
  chars: number;
  charsNoWhitespace: number;
  lines: number;
};

export function countScript(text: string): ScriptCounts {
  const chars = text.length;
  const charsNoWhitespace = text.replace(/\s/g, "").length;
  const lines = text.length === 0 ? 0 : text.split(/\r?\n/).length;
  return { chars, charsNoWhitespace, lines };
}

export function formatCountSummary(c: ScriptCounts): string {
  return `${c.chars}文字（空白除く ${c.charsNoWhitespace}）· ${c.lines}行`;
}
