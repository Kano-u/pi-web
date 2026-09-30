"use client";

import { FormEvent, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

/**
 * 在默认目录下新建（或复用）一个项目文件夹。
 *
 * `defaultPath` 仅用于向用户展示项目会落在哪里；真正的创建由父组件提交，
 * 这样默认目录的解析和校验仍然只有 `/api/default-cwd` 一个来源。
 */
export function NewProjectDialog({
  defaultPath,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  defaultPath: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const candidate = name.trim();
    if (!candidate) {
      setLocalError(t("sidebar.newProjectRequired"));
      return;
    }
    if (candidate === "." || candidate === ".." || /[/\\]/.test(candidate)) {
      setLocalError(t("sidebar.newProjectInvalid"));
      return;
    }
    setLocalError(null);
    onSubmit(candidate);
  };

  const message = localError ?? error;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || busy) return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onSubmit={handleSubmit}
        style={{
          width: 440,
          maxWidth: "100%",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-panel)",
          boxShadow: "0 12px 36px rgba(0,0,0,0.24)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", gap: 12, padding: "18px 18px 14px" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: 1 }}
          >
            <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4Z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div id="new-project-title" style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              {t("sidebar.newProject")}
            </div>
            <label
              htmlFor="new-project-name"
              style={{ display: "block", marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}
            >
              {t("sidebar.newProjectName")}
            </label>
            <input
              id="new-project-name"
              type="text"
              value={name}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setName(event.target.value);
                setLocalError(null);
              }}
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                height: 34,
                marginTop: 6,
                padding: "0 10px",
                border: "1px solid var(--border)",
                borderRadius: 5,
                outline: "none",
                background: "var(--bg)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            />
            {defaultPath && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)", overflowWrap: "anywhere" }}>
                {t("sidebar.newProjectLocation", { path: defaultPath })}
              </div>
            )}
            {message && (
              <div role="alert" style={{ marginTop: 10, color: "#ef4444", fontSize: 12, lineHeight: 1.5 }}>
                {message}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "10px 18px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              height: 32,
              padding: "0 12px",
              border: "1px solid var(--border)",
              borderRadius: 5,
              background: "transparent",
              color: "var(--text-muted)",
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            {t("i18n.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            style={{
              height: 32,
              padding: "0 12px",
              border: "1px solid var(--accent)",
              borderRadius: 5,
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {busy ? t("i18n.checking") : t("sidebar.newProjectConfirm")}
          </button>
        </div>
      </form>
    </div>
  );
}
