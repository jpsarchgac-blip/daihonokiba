import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { MINUTE_PAGE_MARKER } from "@/lib/pages";

const markerLine = Decoration.line({ class: "cm-minute-marker-line" });

const markerPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildMarkerDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildMarkerDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

function buildMarkerDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (line.text.trim() === MINUTE_PAGE_MARKER) {
      builder.add(line.from, line.from, markerLine);
    }
  }
  return builder.finish();
}

export const minuteMarkerHighlight = [markerPlugin];
