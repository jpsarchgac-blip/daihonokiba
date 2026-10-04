import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

export const setReadDocPosEffect = StateEffect.define<number>();

const readDoneMark = Decoration.mark({ class: "cm-read-aloud-done" });
const readCurrentMark = Decoration.mark({ class: "cm-read-aloud-current" });

function buildDecorations(doc: string, readDocPos: number): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const len = doc.length;
  const pos = Math.min(Math.max(0, readDocPos), len);
  const highlightEnd = Math.min(pos + 48, len);

  if (pos > 0) {
    builder.add(0, pos, readDoneMark);
  }
  if (highlightEnd > pos) {
    builder.add(pos, highlightEnd, readCurrentMark);
  }

  return builder.finish();
}

export const readAloudProgressField = StateField.define<DecorationSet>({
  create(state) {
    return Decoration.none;
  },
  update(deco, tr) {
    let readPos: number | null = null;
    for (const effect of tr.effects) {
      if (effect.is(setReadDocPosEffect)) {
        readPos = effect.value;
      }
    }
    if (readPos !== null) {
      return buildDecorations(tr.state.doc.toString(), readPos);
    }
    if (tr.docChanged) {
      return buildDecorations(tr.state.doc.toString(), 0);
    }
    return deco.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const readAloudExtensions = [readAloudProgressField];
