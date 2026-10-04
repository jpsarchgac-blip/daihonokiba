"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatClock,
  MINUTE_PAGE_MARKER,
  PAGE_DURATION_SEC,
  pageDurations,
  parsePages,
} from "@/lib/pages";
import {
  buildNormalizedScript,
  docPositionFromNormIndex,
  isScriptFullyRead,
  matchReadProgress,
  RESET_SESSION_AFTER_ADVANCE,
} from "@/lib/speechMatch";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  applyColorModeToDocument,
  defaultSettings,
  loadSettings,
  saveSettings,
  type DaihonSettings,
} from "@/lib/storage";
import { countScript, formatCountSummary } from "@/lib/scriptStats";
import { usePresentationTimer } from "@/hooks/usePresentationTimer";
import {
  ScriptEditor,
  type ScriptEditorHandle,
} from "@/components/ScriptEditor";
import { PresenterEditor } from "@/components/PresenterEditor";
import { PreviewControls } from "@/components/PreviewControls";
import { ImportExportButtons } from "@/components/ImportExportButtons";

type Tab = "edit" | "preview" | "present";

export function DaihonApp() {
  const [settings, setSettings] = useState<DaihonSettings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("edit");
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const editorRef = useRef<ScriptEditorHandle>(null);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applyColorModeToDocument(loaded.colorMode);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSettings(settings);
    applyColorModeToDocument(settings.colorMode);
  }, [settings, hydrated]);

  const pages = useMemo(() => parsePages(settings.script), [settings.script]);
  const totalCounts = useMemo(
    () => countScript(settings.script),
    [settings.script],
  );

  useEffect(() => {
    if (previewPageIndex >= pages.length) {
      setPreviewPageIndex(Math.max(0, pages.length - 1));
    }
  }, [pages.length, previewPageIndex]);

  const durations = useMemo(() => pageDurations(pages.length), [pages.length]);

  const presenterStyle = useMemo(
    () => ({
      fontSizePx: settings.previewFontSizePx,
      lineHeight: settings.previewLineHeight,
      fontFamily: settings.previewFontFamily,
    }),
    [
      settings.previewFontSizePx,
      settings.previewLineHeight,
      settings.previewFontFamily,
    ],
  );

  const timer = usePresentationTimer(durations);
  const speechActive = tab === "present" && settings.speechAssist;
  const speech = useSpeechRecognition(speechActive);
  const [readByPage, setReadByPage] = useState<Record<number, number>>({});
  const pageIndexRef = useRef(timer.slideIndex);
  pageIndexRef.current = timer.slideIndex;

  const currentPage = pages[timer.slideIndex];
  const previewPage = pages[previewPageIndex];
  const pageNormMap = useMemo(
    () => buildNormalizedScript(currentPage?.text ?? ""),
    [currentPage?.text],
  );
  const readNormIndex = readByPage[timer.slideIndex] ?? 0;
  const readDocPos = docPositionFromNormIndex(pageNormMap, readNormIndex);
  const readPercent =
    pageNormMap.normalized.length > 0
      ? Math.round((readNormIndex / pageNormMap.normalized.length) * 100)
      : 0;

  const applySpeechBuffer = useCallback(
    (spoken: string) => {
      const page = pages[pageIndexRef.current];
      if (!page) return;
      const map = buildNormalizedScript(page.text);
      const idx = pageIndexRef.current;

      setReadByPage((prev) => {
        const current = prev[idx] ?? 0;
        const next = matchReadProgress(map, current, spoken);
        if (next <= current) return prev;

        if (next - current >= RESET_SESSION_AFTER_ADVANCE) {
          queueMicrotask(() => speech.resetSession());
        }

        if (
          settings.autoAdvanceOnRead &&
          isScriptFullyRead(map, next) &&
          idx < pages.length - 1
        ) {
          queueMicrotask(() => {
            speech.resetSession();
            timer.nextSlide();
          });
        }

        return { ...prev, [idx]: next };
      });
    },
    [pages, settings.autoAdvanceOnRead, speech.resetSession, timer.nextSlide],
  );

  useEffect(() => {
    speech.setHandlers({
      onFinalTranscript: (_chunk, session) => applySpeechBuffer(session),
      onInterimTranscript: (_chunk, combined) => applySpeechBuffer(combined),
    });
  }, [speech.setHandlers, applySpeechBuffer]);

  useEffect(() => {
    speech.resetSession();
  }, [timer.slideIndex, speech.resetSession]);

  const restartAll = useCallback(() => {
    timer.restart();
    setReadByPage({});
    speech.resetSession();
  }, [timer.restart, speech.resetSession]);

  const pageProgress =
    PAGE_DURATION_SEC > 0 ? 1 - timer.slideRemaining / PAGE_DURATION_SEC : 0;
  const totalSeconds = durations.reduce((a, b) => a + b, 0);
  const totalProgress =
    totalSeconds > 0 ? 1 - timer.totalRemaining / totalSeconds : 0;

  const update = useCallback((patch: Partial<DaihonSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab !== "present") return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        timer.toggle();
      }
      if (e.key === "ArrowRight") timer.nextSlide();
      if (e.key === "ArrowLeft") timer.prevSlide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, timer]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app text-app-muted">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app text-app-fg">
      <header className="border-b border-app bg-app/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">台本おき</h1>
            <p className="text-sm text-app-muted">
              1分区切りの原稿を、1分ごとにページ送り
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                update({
                  colorMode:
                    settings.colorMode === "dark" ? "light" : "dark",
                })
              }
              className="app-btn-secondary text-sm"
              aria-label="テーマ切替"
            >
              {settings.colorMode === "dark" ? "ライト" : "ダーク"}
            </button>
            <nav className="flex rounded-lg border border-app p-0.5">
              <TabButton
                active={tab === "edit"}
                onClick={() => setTab("edit")}
                label="編集"
              />
              <TabButton
                active={tab === "preview"}
                onClick={() => setTab("preview")}
                label="プレビュー"
              />
              <TabButton
                active={tab === "present"}
                onClick={() => setTab("present")}
                label="発表"
              />
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === "edit" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <section className="app-panel overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app px-4 py-3">
                <div>
                  <h2 className="font-medium">原稿（CodeMirror 6）</h2>
                  <p className="mt-1 text-xs text-app-muted">
                    行だけに{" "}
                    <code className="text-app-fg">{MINUTE_PAGE_MARKER}</code>
                    で1分ページ区切り
                  </p>
                  <p className="mt-2 text-xs text-app-subtle">
                    全体: {formatCountSummary(totalCounts)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => editorRef.current?.insertMinuteMarker()}
                  className="app-btn-secondary shrink-0 text-sm"
                >
                  1分区切りを挿入
                </button>
              </div>
              <ScriptEditor
                ref={editorRef}
                value={settings.script}
                onChange={(script) => update({ script })}
                minHeight="min(70vh, 640px)"
                colorMode={settings.colorMode}
              />
            </section>

            <aside className="space-y-4">
              <Panel title="発表時間">
                <p className="text-2xl font-semibold tabular-nums">
                  {pages.length} 分
                </p>
                <p className="mt-1 text-xs text-app-muted">
                  {pages.length} ページ × 1分
                </p>
              </Panel>

              <Panel title="ファイル">
                <ImportExportButtons
                  settings={settings}
                  onImport={(next) => setSettings(next)}
                />
              </Panel>

              <Panel title="音声追跡">
                <Checkbox
                  checked={settings.speechAssist}
                  onChange={(speechAssist) => update({ speechAssist })}
                  label="マイクで読み上げ位置を追跡"
                />
                <p className="mt-2 text-xs text-app-muted">
                  言い回しの違いや要約後の復帰にも対応。Chrome / Edge 推奨。
                </p>
                {settings.speechAssist && (
                  <div className="mt-3">
                    <Checkbox
                      checked={settings.autoAdvanceOnRead}
                      onChange={(autoAdvanceOnRead) =>
                        update({ autoAdvanceOnRead })
                      }
                      label="読み終えたら次のページへ"
                    />
                  </div>
                )}
              </Panel>

              <Panel title={`ページ一覧（${pages.length}）`}>
                <ul className="max-h-[40vh] space-y-2 overflow-y-auto text-sm">
                  {pages.map((page, i) => {
                    const c = countScript(page.text);
                    return (
                      <li
                        key={page.id}
                        className="rounded-lg border border-app bg-app-surface-solid px-3 py-2"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">{i + 1}分目</span>
                          <span className="text-xs tabular-nums text-app-muted">
                            {c.chars}字 / {c.lines}行
                          </span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-app-subtle">
                          {page.text.split(/\r?\n/)[0]}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </aside>
          </div>
        )}

        {tab === "preview" && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-4">
              <Panel title="表示設定">
                <PreviewControls settings={settings} onChange={update} />
              </Panel>
              <Panel title="ページ">
                <label className="block text-sm text-app-muted">
                  プレビューするページ
                  <select
                    value={previewPageIndex}
                    onChange={(e) =>
                      setPreviewPageIndex(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-lg border border-app bg-app-surface-solid px-3 py-2 text-app-fg"
                  >
                    {pages.map((page, i) => {
                      const c = countScript(page.text);
                      return (
                        <option key={page.id} value={i}>
                          {i + 1}分目（{c.chars}字）
                        </option>
                      );
                    })}
                  </select>
                </label>
                {previewPage && (
                  <p className="mt-3 text-xs text-app-muted">
                    このページ: {formatCountSummary(countScript(previewPage.text))}
                  </p>
                )}
              </Panel>
            </aside>
            <section className="app-panel present-shell flex min-h-[min(75vh,760px)] flex-col px-6 py-8">
              {previewPage ? (
                <>
                  <p className="mb-4 text-sm text-app-muted">
                    発表時の見え方プレビュー（{settings.previewFontSizePx}px /
                    行間 {settings.previewLineHeight.toFixed(2)}）
                  </p>
                  <div className="min-h-0 flex-1">
                    <PresenterEditor
                      value={previewPage.text}
                      colorMode={settings.colorMode}
                      presenterStyle={presenterStyle}
                      className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
                    />
                  </div>
                </>
              ) : (
                <p className="text-app-muted">原稿を入力してください。</p>
              )}
            </section>
          </div>
        )}

        {tab === "present" && (
          <div className="space-y-4">
            <div className="app-panel flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={timer.toggle}
                className="app-btn-primary"
              >
                {timer.isRunning ? "一時停止" : "開始"}
              </button>
              <button
                type="button"
                onClick={restartAll}
                className="app-btn-secondary text-sm"
              >
                最初から
              </button>
              <label className="flex items-center gap-2 app-btn-secondary text-sm">
                <input
                  type="checkbox"
                  checked={settings.speechAssist}
                  onChange={(e) =>
                    update({ speechAssist: e.target.checked })
                  }
                  className="accent-emerald-500"
                  disabled={!speech.isSupported}
                />
                音声追跡
              </label>
              <button
                type="button"
                onClick={timer.prevSlide}
                disabled={timer.slideIndex === 0}
                className="app-btn-secondary text-sm disabled:opacity-40"
              >
                前へ
              </button>
              <button
                type="button"
                onClick={timer.nextSlide}
                disabled={timer.slideIndex >= pages.length - 1}
                className="app-btn-secondary text-sm disabled:opacity-40"
              >
                次へ
              </button>
              <div className="ml-auto flex flex-wrap gap-4 text-sm tabular-nums">
                <span>
                  ページ {timer.slideIndex + 1} / {pages.length}
                </span>
                <span className="text-amber-600 dark:text-amber-300">
                  残り {formatClock(timer.slideRemaining)}
                </span>
                <span className="text-app-muted">
                  全体 {formatClock(timer.totalRemaining)}
                </span>
                {settings.speechAssist && (
                  <span className="text-sky-600 dark:text-sky-300">
                    読了 {readPercent}%
                    {speech.isListening ? " · 聞き取り中" : ""}
                  </span>
                )}
              </div>
            </div>

            <details className="app-panel px-4 py-3">
              <summary className="cursor-pointer text-sm text-app-muted">
                表示サイズ（プレビューと共通）
              </summary>
              <div className="mt-3 max-w-md">
                <PreviewControls
                  settings={settings}
                  onChange={update}
                  compact
                />
              </div>
            </details>

            {settings.speechAssist && !speech.isSupported && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
                このブラウザは音声認識 API に対応していません。
              </p>
            )}
            {speech.error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm">
                音声認識エラー: {speechErrorLabel(speech.error)}
              </p>
            )}

            <div className="h-1.5 overflow-hidden rounded-full bg-app-border">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${totalProgress * 100}%` }}
              />
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-app-border/80">
              <div
                className="h-full bg-sky-500 transition-[width] duration-300"
                style={{ width: `${pageProgress * 100}%` }}
              />
            </div>

            <section
              className="app-panel present-shell min-h-[min(72vh,720px)] px-6 py-8"
              aria-live="polite"
            >
              {currentPage ? (
                <div className="flex h-full min-h-[min(68vh,680px)] flex-col gap-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-app-muted">
                    <span>
                      {timer.slideIndex + 1} 分目 · 自動切替まで{" "}
                      {formatClock(timer.slideRemaining)}
                    </span>
                    <span className="text-xs tabular-nums">
                      {formatCountSummary(countScript(currentPage.text))}
                    </span>
                  </div>
                  <div className="min-h-0 flex-1">
                    <PresenterEditor
                      value={currentPage.text}
                      readDocPos={settings.speechAssist ? readDocPos : 0}
                      colorMode={settings.colorMode}
                      presenterStyle={presenterStyle}
                      className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
                    />
                  </div>
                  {settings.speechAssist && speech.interimText && (
                    <p className="truncate text-xs text-app-subtle">
                      認識中: {speech.interimText}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-app-muted">原稿を編集タブで入力してください。</p>
              )}
            </section>

            <p className="text-center text-xs text-app-subtle">
              スペース: 開始/停止 · ←→: ページ移動 · 各ページ1分で自動切替
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
        active ? "bg-[var(--app-tab-active-bg)] text-[var(--app-tab-active-fg)]" : "text-app-muted hover:text-app-fg"
      }`}
    >
      {label}
    </button>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-panel p-4">
      <h3 className="mb-3 text-sm font-medium text-app-muted">{title}</h3>
      {children}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-app-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-emerald-500"
      />
      {label}
    </label>
  );
}

function speechErrorLabel(code: string): string {
  switch (code) {
    case "not-allowed":
      return "マイクの使用が許可されていません";
    case "service-not-allowed":
      return "音声認識がブラウザ設定でブロックされています";
    case "network":
      return "ネットワークエラー（Chrome はクラウド認識を利用します）";
    case "audio-capture":
      return "マイクを取得できませんでした";
    default:
      return code;
  }
}
