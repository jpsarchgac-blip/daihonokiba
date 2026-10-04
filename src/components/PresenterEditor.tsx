"use client";

import { useEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { createPresenterTheme, type PresenterStyle } from "@/lib/codemirrorTheme";
import {
  readAloudExtensions,
  setReadDocPosEffect,
} from "@/lib/readAloudDecorations";
import type { ColorMode } from "@/lib/storage";

type Props = {
  value: string;
  readDocPos?: number;
  className?: string;
  colorMode: ColorMode;
  presenterStyle: PresenterStyle;
};

export function PresenterEditor({
  value,
  readDocPos = 0,
  className,
  colorMode,
  presenterStyle,
}: Props) {
  const viewRef = useRef<EditorView | null>(null);

  const extensions = useMemo(
    () => [
      markdown(),
      createPresenterTheme(presenterStyle),
      EditorView.lineWrapping,
      EditorView.editable.of(false),
      ...readAloudExtensions,
    ],
    [presenterStyle],
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setReadDocPosEffect.of(readDocPos),
    });
  }, [readDocPos, value]);

  return (
    <CodeMirror
      className={className}
      value={value}
      height="100%"
      theme={colorMode === "light" ? "light" : "dark"}
      extensions={extensions}
      editable={false}
      basicSetup={false}
      onCreateEditor={(view) => {
        viewRef.current = view;
        view.dispatch({
          effects: setReadDocPosEffect.of(readDocPos),
        });
      }}
    />
  );
}
