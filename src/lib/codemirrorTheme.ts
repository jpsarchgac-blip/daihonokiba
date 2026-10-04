import { EditorView } from "@codemirror/view";
import type { PreviewFontFamily } from "@/lib/storage";

export const editorTheme = EditorView.theme({
  "&": {
    fontSize: "15px",
    backgroundColor: "var(--cm-bg)",
    color: "var(--cm-fg)",
  },
  ".cm-content": {
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
    lineHeight: "1.65",
    padding: "12px 0",
  },
  ".cm-gutters": {
    backgroundColor: "var(--cm-gutter)",
    color: "var(--cm-gutter-fg)",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--cm-accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--cm-selection) !important",
  },
});

const fontStacks: Record<PreviewFontFamily, string> = {
  sans: 'var(--font-geist-sans), "Hiragino Sans", system-ui, sans-serif',
  serif: '"Hiragino Mincho ProN", "Yu Mincho", ui-serif, serif',
  mono: 'var(--font-geist-mono), ui-monospace, monospace',
};

export type PresenterStyle = {
  fontSizePx: number;
  lineHeight: number;
  fontFamily: PreviewFontFamily;
};

export function createPresenterTheme(style: PresenterStyle) {
  return EditorView.theme({
    "&": {
      fontSize: `${style.fontSizePx}px`,
      backgroundColor: "transparent",
      color: "var(--cm-present-fg)",
    },
    ".cm-content": {
      fontFamily: fontStacks[style.fontFamily],
      lineHeight: String(style.lineHeight),
      padding: "8px 0",
    },
    ".cm-line": {
      padding: "0 4px",
    },
    ".cm-gutters": {
      display: "none",
    },
  });
}
