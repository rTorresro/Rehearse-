import type { Monaco } from "@monaco-editor/react";

export const THEME_NAME = "rehearse-dark";

// Monaco wants literal hex colors, so read the design tokens off :root at runtime.
// swapping the accent in globals.css still recolors the editor
function token(css: CSSStyleDeclaration, name: string, fallback: string) {
  return css.getPropertyValue(`--color-${name}`).trim() || fallback;
}

export function defineRehearseTheme(monaco: Monaco) {
  const css = getComputedStyle(document.documentElement);
  const t = (name: string, fallback: string) => token(css, name, fallback);
  const bare = (hex: string) => hex.replace("#", "");
  const accent = t("accent", "#2dd4bf");

  monaco.editor.defineTheme(THEME_NAME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: bare(t("fg", "#e6e9ee")) },
      { token: "keyword", foreground: bare(t("syntax-keyword", "#c4a7ff")) },
      { token: "type", foreground: bare(t("syntax-function", "#7aa2f7")) },
      { token: "number", foreground: bare(t("syntax-number", "#ff9e64")) },
      { token: "string", foreground: bare(t("syntax-string", "#9ece6a")) },
      { token: "comment", foreground: bare(t("syntax-comment", "#8491a3")), fontStyle: "" },
      { token: "delimiter", foreground: bare(t("fg-2", "#c4cbd6")) },
    ],
    colors: {
      "editor.background": t("surface-1", "#0e1116"),
      "editor.foreground": t("fg", "#e6e9ee"),
      "editorGutter.background": t("surface-1", "#0e1116"),
      "editorLineNumber.foreground": t("code-number", "#6f7a8a"),
      "editorLineNumber.activeForeground": t("fg-2", "#c4cbd6"),
      // the spec's accent-soft: accent at 14% alpha
      "editor.lineHighlightBackground": `${accent}24`,
      "editor.lineHighlightBorder": "#00000000",
      "editorCursor.foreground": accent,
      "editor.selectionBackground": `${accent}40`,
      "editor.inactiveSelectionBackground": `${accent}26`,
      "editorIndentGuide.background1": t("line", "#232830"),
      "editorIndentGuide.activeBackground1": t("line-strong", "#2f3742"),
      "editorWidget.background": t("surface-2", "#12151a"),
      "editorWidget.border": t("line", "#232830"),
      "editorSuggestWidget.selectedBackground": t("surface-3", "#161b22"),
      "scrollbarSlider.background": `${t("line-strong", "#2f3742")}99`,
      "scrollbarSlider.hoverBackground": t("line-strong", "#2f3742"),
      focusBorder: t("focus", "#8fe9dc"),
      // diffs: the success and danger colors, faint for lines and stronger for the exact change
      "diffEditor.insertedLineBackground": `${t("success", "#5fd39a")}1a`,
      "diffEditor.insertedTextBackground": `${t("success", "#5fd39a")}33`,
      "diffEditor.removedLineBackground": `${t("danger", "#ff8a8a")}1a`,
      "diffEditor.removedTextBackground": `${t("danger", "#ff8a8a")}33`,
      "diffEditor.border": t("line", "#232830"),
      // no rainbow brackets: one accent, everything else neutral
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((n) => [
          `editorBracketHighlight.foreground${n}`,
          t("fg-2", "#c4cbd6"),
        ]),
      ),
      "editorBracketMatch.background": `${accent}24`,
      "editorBracketMatch.border": `${accent}80`,
    },
  });
}

// the next/font family for JetBrains Mono, so the editor matches the rest of the app
export function monoFontFamily() {
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-jetbrains-mono")
    .trim();
  return family ? `${family}, ui-monospace, monospace` : "ui-monospace, monospace";
}
