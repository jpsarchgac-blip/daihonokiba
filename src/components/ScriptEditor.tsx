"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { editorTheme } from "@/lib/codemirrorTheme";
import { minuteMarkerHighlight } from "@/lib/minuteMarkerHighlight";
import { insertMinuteMarkerAt } from "@/lib/pages";
import type { ColorMode } from "@/lib/storage";

export type ScriptEditorHandle = {
  insertMinuteMarker: () => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
  className?: string;
  colorMode: ColorMode;
};

export const ScriptEditor = forwardRef<ScriptEditorHandle, Props>(
  function ScriptEditor(
    {
      value,
      onChange,
      readOnly = false,
      minHeight = "420px",
      className,
      colorMode,
    },
    ref,
  ) {
    const viewRef = useRef<EditorView | null>(null);

    useImperativeHandle(ref, () => ({
      insertMinuteMarker() {
        const view = viewRef.current;
        if (!view || readOnly) return;
        const doc = view.state.doc.toString();
        const { from, to } = view.state.selection.main;
        const { text, selection } = insertMinuteMarkerAt(doc, from, to);
        onChange(text);
        queueMicrotask(() => {
          view.dispatch({
            selection: { anchor: selection },
            scrollIntoView: true,
          });
        });
      },
    }));

    return (
      <CodeMirror
        className={className}
        value={value}
        height={minHeight}
        theme={colorMode === "light" ? "light" : "dark"}
        extensions={[
          markdown(),
          editorTheme,
          EditorView.lineWrapping,
          EditorView.editable.of(!readOnly),
          ...minuteMarkerHighlight,
        ]}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
        }}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
      />
    );
  },
);
