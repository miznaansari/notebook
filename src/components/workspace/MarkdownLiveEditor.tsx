"use client";

import * as React from "react";
import { Annotation, Compartment, EditorState, type Range, StateEffect, Transaction } from "@codemirror/state";
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
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { findNoteLinks, normalizeNoteTitle } from "@/lib/note-links";

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
  // [[Note Title]] links render as chips only when onOpenLink is given; linkTitles holds the
  // normalized titles that exist, so missing targets can be shown differently
  linkTitles?: Set<string>;
  onOpenLink?: (title: string) => void;
  onScroll?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  // Built-in undo/redo. Off by default: the notepad runs its own undo stack for notes.
  withHistory?: boolean;
  handleRef?: React.Ref<MarkdownEditorHandle>;
  className?: string;
}

// Same line rules as the Interactive view
export const MD_TASK_PREFIX = /^(\s*)(-\s*\[([ xX])?\]\s?)/;
const MD_BULLET_PREFIX = /^(\s*)([-*•])(\s)/;
const MD_HEADING_PREFIX = /^(#{1,3})\s/;

// Marks transactions that only mirror the `value` prop, so they aren't echoed back through onChange
const syncFromProps = Annotation.define<boolean>();
// Asks the live preview to rebuild (link targets changed without a document change)
const refreshLinks = StateEffect.define<null>();

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

interface LinkHooks {
  enabled: () => boolean;
  exists: (title: string) => boolean;
  open: (title: string) => void;
}

// [[Note Title]] chip; dashed when no note has that title yet
class NoteLinkWidget extends WidgetType {
  constructor(
    readonly title: string,
    readonly exists: boolean,
    readonly hooks: LinkHooks
  ) {
    super();
  }

  eq(other: NoteLinkWidget) {
    return other.title === this.title && other.exists === this.exists;
  }

  toDOM() {
    const chip = document.createElement("span");
    chip.className = this.exists ? "cm-md-link" : "cm-md-link cm-md-link-missing";
    chip.textContent = this.title;
    chip.title = this.exists ? `Open "${this.title}"` : `Create note "${this.title}"`;
    chip.setAttribute("role", "link");
    chip.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.hooks.open(this.title);
    });
    return chip;
  }

  ignoreEvent() {
    return true;
  }
}

// Builds the live-preview decorations for visible lines: headings get real sizes with their
// "#" marks hidden, task prefixes become checkboxes, bullet prefixes become dots, and
// [[note links]] become chips. Replaced ranges are also returned as atomic ranges so the
// caret steps over them as one unit.
function buildDecorations(view: EditorView, onToggle: ToggleTask, links: LinkHooks) {
  const decorations: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  const replace = (from: number, to: number, decoration: Decoration) => {
    decorations.push(decoration.range(from, to));
    atomic.push(decoration.range(from, to));
  };
  const linksEnabled = links.enabled();
  let nextLineFrom = 0;

  for (const { from, to } of view.visibleRanges) {
    for (let pos = Math.max(from, nextLineFrom); pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      nextLineFrom = line.to + 1;
      pos = line.to + 1;
      let bodyStart = 0;

      const heading = text.match(MD_HEADING_PREFIX);
      const task = heading ? null : text.match(MD_TASK_PREFIX);
      const bullet = heading || task ? null : text.match(MD_BULLET_PREFIX);

      if (heading) {
        bodyStart = heading[0].length;
        decorations.push(Decoration.line({ class: `cm-md-h${heading[1].length}` }).range(line.from));
        replace(line.from, line.from + bodyStart, hiddenMarks);
      } else if (task) {
        const checked = task[3] === "x" || task[3] === "X";
        const prefixStart = line.from + task[1].length;
        bodyStart = task[1].length + task[2].length;
        replace(prefixStart, line.from + bodyStart, Decoration.replace({ widget: new CheckboxWidget(checked, onToggle) }));
        if (checked && line.from + bodyStart < line.to) {
          decorations.push(doneText.range(line.from + bodyStart, line.to));
        }
      } else if (bullet) {
        bodyStart = bullet[1].length + bullet[2].length + bullet[3].length;
        replace(line.from + bullet[1].length, line.from + bodyStart, Decoration.replace({ widget: bulletWidget }));
      }

      if (linksEnabled) {
        for (const link of findNoteLinks(text)) {
          if (link.from < bodyStart) continue;
          const widget = new NoteLinkWidget(link.title, links.exists(link.title), links);
          replace(line.from + link.from, line.from + link.to, Decoration.replace({ widget }));
        }
      }
    }
  }

  return { decorations: Decoration.set(decorations, true), atomic: Decoration.set(atomic, true) };
}

const editableExtensions = (readOnly: boolean) => [
  EditorView.editable.of(!readOnly),
  EditorState.readOnly.of(readOnly),
];

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
  ".cm-md-link": {
    display: "inline-block",
    padding: "0 6px",
    margin: "0 1px",
    lineHeight: "1.45",
    borderRadius: "6px",
    border: "1px solid #BFDBFE",
    backgroundColor: "#EFF6FF",
    color: "#2563EB",
    fontWeight: "600",
    textDecoration: "none",
    cursor: "pointer",
  },
  ".cm-md-link:hover": { backgroundColor: "#DBEAFE", borderColor: "#3B82F6" },
  ".cm-md-link.cm-md-link-missing": {
    border: "1px dashed #9CA3AF",
    backgroundColor: "transparent",
    color: "#6B7280",
  },
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
  linkTitles,
  onOpenLink,
  onScroll,
  placeholder,
  readOnly = false,
  withHistory = false,
  handleRef,
  className,
}: MarkdownLiveEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const initialValueRef = React.useRef(value);
  const placeholderRef = React.useRef(placeholder);
  const withHistoryRef = React.useRef(withHistory);
  const readOnlyRef = React.useRef(readOnly);
  const [editableCompartment] = React.useState(() => new Compartment());
  const callbacksRef = React.useRef({ onChange, onKeyDown, onSelectionChange, onContextMenu, onToggleTask, onScroll, onOpenLink });
  const linkTitlesRef = React.useRef(linkTitles);

  React.useLayoutEffect(() => {
    callbacksRef.current = { onChange, onKeyDown, onSelectionChange, onContextMenu, onToggleTask, onScroll, onOpenLink };
  });

  React.useLayoutEffect(() => {
    const toggleTask: ToggleTask = (view, dom) => {
      const line = view.state.doc.lineAt(view.posAtDOM(dom));
      callbacksRef.current.onToggleTask?.(line.from);
    };
    const linkHooks: LinkHooks = {
      enabled: () => Boolean(callbacksRef.current.onOpenLink),
      exists: (title) => linkTitlesRef.current?.has(normalizeNoteTitle(title)) ?? false,
      open: (title) => callbacksRef.current.onOpenLink?.(title),
    };

    const livePreview = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        atomic: DecorationSet;

        constructor(view: EditorView) {
          ({ decorations: this.decorations, atomic: this.atomic } = buildDecorations(view, toggleTask, linkHooks));
        }

        update(update: ViewUpdate) {
          const linksChanged = update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshLinks)));
          if (update.docChanged || update.viewportChanged || linksChanged) {
            ({ decorations: this.decorations, atomic: this.atomic } = buildDecorations(update.view, toggleTask, linkHooks));
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
          withHistoryRef.current ? [history(), keymap.of(historyKeymap)] : [],
          keymap.of(defaultKeymap),
          editableCompartment.of(editableExtensions(readOnlyRef.current)),
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
  }, [editableCompartment]);

  // Re-render link chips when notes are added, renamed, or deleted
  React.useLayoutEffect(() => {
    linkTitlesRef.current = linkTitles;
    viewRef.current?.dispatch({ effects: refreshLinks.of(null) });
  }, [linkTitles]);

  React.useLayoutEffect(() => {
    viewRef.current?.dispatch({ effects: editableCompartment.reconfigure(editableExtensions(readOnly)) });
  }, [readOnly, editableCompartment]);

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
      annotations: [syncFromProps.of(true), Transaction.addToHistory.of(false)],
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
