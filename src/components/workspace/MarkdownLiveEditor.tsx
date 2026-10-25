"use client";

import * as React from "react";
import { Annotation, EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  keymap,
  placeholder as placeholderExtension,
} from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";

// Textarea-like handle, so the notepad's selection / insertion logic works unchanged on CodeMirror
export interface MarkdownEditorHandle {
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly value: string;
  readonly hasFocus: boolean;
  setSelectionRange(start: number, end: number): void;
  focus(): void;
  // Viewport rect around the current selection, or null when it isn't on screen
  getSelectionCoords(): { left: number; right: number; top: number; bottom: number } | null;
}

interface MarkdownLiveEditorProps {
  value: string;
  onChange: (value: string, cursorPos: number) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onSelectionChange?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  onToggleTask?: (lineStart: number) => void;
  onScroll?: () => void;
  placeholder?: string;
  handleRef?: React.Ref<MarkdownEditorHandle>;
  className?: string;
}

// Same line rules as the Interactive view
export const MD_TASK_PREFIX = /^(\s*)(-\s*\[([ xX])?\]\s?)/;
const MD_BULLET_PREFIX = /^(\s*)([-*•])(\s)/;
const MD_HEADING_PREFIX = /^(#{1,3})\s/;

// Marks transactions that only mirror the `value` prop, so they aren't echoed back through onChange
const syncFromProps = Annotation.define<boolean>();

type ToggleTask = (view: EditorView, dom: HTMLElement) => void;

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly onToggle: ToggleTask
  ) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView) {
    const box = document.createElement("span");
    box.className = this.checked ? "cm-md-checkbox cm-md-checkbox-checked" : "cm-md-checkbox";
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.title = this.checked ? "Mark incomplete" : "Mark completed";
    if (this.checked) {
      box.innerHTML =
        '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    }
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.onToggle(view, box);
    });
    return box;
  }

  ignoreEvent() {
    return true;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-md-bullet";
    return dot;
  }
}

const bulletWidget = new BulletWidget();
const hiddenMarks = Decoration.replace({});
const doneText = Decoration.mark({ class: "cm-md-done" });

// Builds the live-preview decorations for visible lines: headings get real sizes with their
// "#" marks hidden, task prefixes become checkboxes, bullet prefixes become dots. Replaced
// prefixes are also returned as atomic ranges so the caret steps over them as one unit.
function buildDecorations(view: EditorView, onToggle: ToggleTask) {
  const decorations = new RangeSetBuilder<Decoration>();
  const atomic = new RangeSetBuilder<Decoration>();
  let nextLineFrom = 0;

  for (const { from, to } of view.visibleRanges) {
    for (let pos = Math.max(from, nextLineFrom); pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      nextLineFrom = line.to + 1;
      pos = line.to + 1;

      const heading = text.match(MD_HEADING_PREFIX);
      if (heading) {
        const marksEnd = line.from + heading[0].length;
        decorations.add(line.from, line.from, Decoration.line({ class: `cm-md-h${heading[1].length}` }));
        decorations.add(line.from, marksEnd, hiddenMarks);
        atomic.add(line.from, marksEnd, hiddenMarks);
        continue;
      }

      const task = text.match(MD_TASK_PREFIX);
      if (task) {
        const checked = task[3] === "x" || task[3] === "X";
        const prefixStart = line.from + task[1].length;
        const prefixEnd = prefixStart + task[2].length;
        const checkbox = Decoration.replace({ widget: new CheckboxWidget(checked, onToggle) });
        decorations.add(prefixStart, prefixEnd, checkbox);
        atomic.add(prefixStart, prefixEnd, checkbox);
        if (checked && prefixEnd < line.to) {
          decorations.add(prefixEnd, line.to, doneText);
        }
        continue;
      }

      const bullet = text.match(MD_BULLET_PREFIX);
      if (bullet) {
        const prefixStart = line.from + bullet[1].length;
        const prefixEnd = prefixStart + bullet[2].length + bullet[3].length;
        const dot = Decoration.replace({ widget: bulletWidget });
        decorations.add(prefixStart, prefixEnd, dot);
        atomic.add(prefixStart, prefixEnd, dot);
      }
    }
  }

  return { decorations: decorations.finish(), atomic: atomic.finish() };
}

const editorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "#111827" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.625", overflow: "auto" },
  ".cm-content": { padding: "16px 0", caretColor: "#111827" },
  ".cm-line": { padding: "0 16px" },
  ".cm-placeholder": { color: "#9ca3af", whiteSpace: "pre-line" },
  ".cm-md-h1": { fontSize: "1.65em", fontWeight: "800", lineHeight: "1.3", padding: "0.35em 16px 0.1em", color: "#030712" },
  ".cm-md-h2": { fontSize: "1.35em", fontWeight: "700", lineHeight: "1.35", padding: "0.3em 16px 0.05em", color: "#1e1b4b" },
  ".cm-md-h3": { fontSize: "1.15em", fontWeight: "700", lineHeight: "1.4", padding: "0.2em 16px 0", color: "#1f2937" },
  ".cm-md-checkbox": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: "15px",
    height: "15px",
    marginRight: "8px",
    verticalAlign: "-2px",
    border: "2px solid #9ca3af",
    borderRadius: "4px",
    backgroundColor: "#ffffff",
    color: "#ffffff",
    cursor: "pointer",
  },
  ".cm-md-checkbox:hover": { borderColor: "#3B82F6", backgroundColor: "#eff6ff" },
  ".cm-md-checkbox.cm-md-checkbox-checked": { borderColor: "#3B82F6", backgroundColor: "#3B82F6" },
  ".cm-md-bullet": {
    display: "inline-block",
    width: "6px",
    height: "6px",
    margin: "0 10px 0 4px",
    verticalAlign: "middle",
    borderRadius: "9999px",
    backgroundColor: "#3B82F6",
  },
  ".cm-md-done": { textDecoration: "line-through", color: "#9ca3af" },
});

// Free-typing Markdown editor with live preview (CodeMirror 6). The document stays plain
// markdown text, so offsets match the note content string one-to-one.
export function MarkdownLiveEditor({
  value,
  onChange,
  onKeyDown,
  onSelectionChange,
  onContextMenu,
  onToggleTask,
  onScroll,
  placeholder,
  handleRef,
  className,
}: MarkdownLiveEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const initialValueRef = React.useRef(value);
  const placeholderRef = React.useRef(placeholder);
  const callbacksRef = React.useRef({ onChange, onKeyDown, onSelectionChange, onContextMenu, onToggleTask, onScroll });

  React.useLayoutEffect(() => {
    callbacksRef.current = { onChange, onKeyDown, onSelectionChange, onContextMenu, onToggleTask, onScroll };
  });

  React.useLayoutEffect(() => {
    const toggleTask: ToggleTask = (view, dom) => {
      const line = view.state.doc.lineAt(view.posAtDOM(dom));
      callbacksRef.current.onToggleTask?.(line.from);
    };

    const livePreview = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        atomic: DecorationSet;

        constructor(view: EditorView) {
          ({ decorations: this.decorations, atomic: this.atomic } = buildDecorations(view, toggleTask));
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            ({ decorations: this.decorations, atomic: this.atomic } = buildDecorations(update.view, toggleTask));
          }
        }
      },
      {
        decorations: (plugin) => plugin.decorations,
        provide: (plugin) =>
          EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none),
      }
    );

    const view = new EditorView({
      parent: containerRef.current!,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          livePreview,
          editorTheme,
          EditorView.lineWrapping,
          keymap.of(defaultKeymap),
          placeholderRef.current ? placeholderExtension(placeholderRef.current) : [],
          EditorView.contentAttributes.of({ spellcheck: "true", "aria-label": "Markdown note editor" }),
          EditorView.domEventHandlers({
            keydown: (e) => {
              callbacksRef.current.onKeyDown?.(e);
              return e.defaultPrevented;
            },
            contextmenu: (e) => {
              callbacksRef.current.onContextMenu?.(e);
              return e.defaultPrevented;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((tr) => tr.annotation(syncFromProps))) {
              callbacksRef.current.onChange(update.state.doc.toString(), update.state.selection.main.head);
            }
            if (update.selectionSet) {
              callbacksRef.current.onSelectionChange?.();
            }
          }),
        ],
      }),
    });
    viewRef.current = view;

    const handleScroll = () => callbacksRef.current.onScroll?.();
    view.scrollDOM.addEventListener("scroll", handleScroll);

    return () => {
      view.scrollDOM.removeEventListener("scroll", handleScroll);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Mirror outside changes (formatting, undo, AI edits, note switch) into the editor as a
  // minimal change, so CodeMirror maps the caret through it instead of resetting it
  React.useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;

    let start = 0;
    while (start < current.length && start < value.length && current[start] === value[start]) start++;
    let endCurrent = current.length;
    let endValue = value.length;
    while (endCurrent > start && endValue > start && current[endCurrent - 1] === value[endValue - 1]) {
      endCurrent--;
      endValue--;
    }

    view.dispatch({
      changes: { from: start, to: endCurrent, insert: value.slice(start, endValue) },
      annotations: syncFromProps.of(true),
    });
  }, [value]);

  React.useImperativeHandle(
    handleRef,
    () => ({
      get selectionStart() {
        return viewRef.current?.state.selection.main.from ?? 0;
      },
      get selectionEnd() {
        return viewRef.current?.state.selection.main.to ?? 0;
      },
      get value() {
        return viewRef.current?.state.doc.toString() ?? "";
      },
      get hasFocus() {
        return viewRef.current?.hasFocus ?? false;
      },
      setSelectionRange(start: number, end: number) {
        const view = viewRef.current;
        if (!view) return;
        const clamp = (pos: number) => Math.max(0, Math.min(pos, view.state.doc.length));
        view.dispatch({ selection: { anchor: clamp(start), head: clamp(end) }, scrollIntoView: true });
      },
      focus() {
        viewRef.current?.focus();
      },
      getSelectionCoords() {
        const view = viewRef.current;
        if (!view) return null;
        const { from, to } = view.state.selection.main;
        const start = view.coordsAtPos(from, 1);
        const end = view.coordsAtPos(to, -1);
        if (!start || !end) return null;
        const scroller = view.scrollDOM.getBoundingClientRect();
        if (end.bottom < scroller.top || start.top > scroller.bottom) return null;
        return {
          left: Math.min(start.left, end.left),
          right: Math.max(start.right, end.right),
          top: Math.max(start.top, scroller.top),
          bottom: Math.min(end.bottom, scroller.bottom),
        };
      },
    }),
    []
  );

  return <div ref={containerRef} className={className} />;
}
