/**
 * Source of `bench/ui.tsx` and `bench/styles.css`, injected into every
 * generated app.
 *
 * This is the biggest lever on output quality. Free-form styling produces a
 * different-looking app every run and a lot of broken layout; a fixed set of
 * primitives means the agent composes rather than invents, and every generated
 * app looks deliberate.
 */

export const STYLES_SOURCE = String.raw`
:root {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --border: #e4e7ec;
  --border-strong: #d0d5dd;
  --text: #101828;
  --text-muted: #667085;
  --accent: #3b5bdb;
  --accent-soft: #eef2ff;
  --danger: #d92d20;
  --danger-soft: #fef3f2;
  --ok: #067647;
  --ok-soft: #ecfdf3;
  --warn: #b54708;
  --warn-soft: #fffaeb;
  --radius: 10px;
  --shadow: 0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.1);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.bench-page { max-width: 1080px; margin: 0 auto; padding: 32px 24px 64px; }

.bench-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.bench-header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
.bench-header p { margin: 0; color: var(--text-muted); }
.bench-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

.bench-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
.bench-card + .bench-card { margin-top: 16px; }
.bench-card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); font-weight: 600; }
.bench-card-body { padding: 20px; }
.bench-card-body.bench-flush { padding: 0; }

.bench-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }

.bench-stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; box-shadow: var(--shadow); }
.bench-stat-label { color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.bench-stat-value { font-size: 26px; font-weight: 600; margin-top: 6px; letter-spacing: -0.02em; }
.bench-stat-hint { margin-top: 4px; font-size: 12px; color: var(--text-muted); }

.bench-btn {
  display: inline-flex; align-items: center; gap: 6px; justify-content: center;
  border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
  border-radius: 8px; padding: 8px 14px; font: inherit; font-weight: 500; cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.bench-btn:hover { background: #f9fafb; }
.bench-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.bench-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.bench-btn-primary:hover { background: #3450c8; }
.bench-btn-danger { background: var(--surface); border-color: var(--border-strong); color: var(--danger); }
.bench-btn-danger:hover { background: var(--danger-soft); }
.bench-btn-ghost { border-color: transparent; background: transparent; color: var(--text-muted); padding: 6px 8px; }
.bench-btn-ghost:hover { background: #f2f4f7; color: var(--text); }
.bench-btn-sm { padding: 5px 10px; font-size: 13px; }

.bench-field { display: block; margin-bottom: 14px; }
.bench-field-label { display: block; font-weight: 500; margin-bottom: 6px; font-size: 13px; }
.bench-field-hint { color: var(--text-muted); font-size: 12px; margin-top: 4px; }
.bench-field-error { color: var(--danger); font-size: 12px; margin-top: 4px; }

.bench-input, .bench-select, .bench-textarea {
  width: 100%; border: 1px solid var(--border-strong); border-radius: 8px;
  padding: 8px 11px; font: inherit; color: var(--text); background: var(--surface);
}
.bench-input:focus, .bench-select:focus, .bench-textarea:focus {
  outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft);
}
.bench-textarea { min-height: 84px; resize: vertical; }
.bench-checkbox { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.bench-checkbox input { width: 16px; height: 16px; accent-color: var(--accent); }

.bench-row { display: flex; gap: 12px; flex-wrap: wrap; }
.bench-row > * { flex: 1 1 180px; }

.bench-table { width: 100%; border-collapse: collapse; }
.bench-table th {
  text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-muted); font-weight: 600; padding: 10px 20px; border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.bench-table td { padding: 12px 20px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.bench-table tr:last-child td { border-bottom: none; }
.bench-table tbody tr:hover { background: #fcfcfd; }
.bench-table-actions { text-align: right; white-space: nowrap; }

.bench-badge {
  display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px;
  font-size: 12px; font-weight: 500; background: #f2f4f7; color: var(--text-muted);
  border: 1px solid var(--border);
}
.bench-badge-accent { background: var(--accent-soft); color: var(--accent); border-color: #dbe2ff; }
.bench-badge-ok { background: var(--ok-soft); color: var(--ok); border-color: #abefc6; }
.bench-badge-warn { background: var(--warn-soft); color: var(--warn); border-color: #fedf89; }
.bench-badge-danger { background: var(--danger-soft); color: var(--danger); border-color: #fecdca; }

.bench-empty { padding: 48px 20px; text-align: center; color: var(--text-muted); }
.bench-empty-title { color: var(--text); font-weight: 600; margin-bottom: 4px; }

.bench-alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border); background: #f2f4f7; color: var(--text); }
.bench-alert-danger { background: var(--danger-soft); color: var(--danger); border-color: #fecdca; }
.bench-alert-warn { background: var(--warn-soft); color: var(--warn); border-color: #fedf89; }
.bench-alert-ok { background: var(--ok-soft); color: var(--ok); border-color: #abefc6; }
.bench-alert-info { background: var(--accent-soft); color: var(--accent); border-color: #dbe2ff; }

.bench-modal-backdrop {
  position: fixed; inset: 0; background: rgba(16, 24, 40, 0.45);
  display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 50;
}
.bench-modal { background: var(--surface); border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 24px -4px rgba(16, 24, 40, 0.1); }
.bench-modal-header { padding: 18px 20px; border-bottom: 1px solid var(--border); font-weight: 600; }
.bench-modal-body { padding: 20px; max-height: 60vh; overflow-y: auto; }
.bench-modal-footer { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }

.bench-toolbar { display: flex; gap: 8px; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.bench-toolbar .bench-input, .bench-toolbar .bench-select { width: auto; min-width: 160px; }
.bench-spacer { flex: 1; }
.bench-muted { color: var(--text-muted); }

.bench-richtext { border: 1px solid var(--border-strong); border-radius: 8px; overflow: hidden; background: var(--surface); }
.bench-richtext:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.bench-richtext-toolbar { display: flex; gap: 2px; padding: 5px; border-bottom: 1px solid var(--border); background: #fafbfc; flex-wrap: wrap; }
.bench-richtext-btn { border: none; background: transparent; border-radius: 5px; padding: 4px 8px; font: inherit; font-size: 13px; color: var(--text-muted); cursor: pointer; min-width: 28px; }
.bench-richtext-btn:hover { background: #eef0f4; color: var(--text); }
.bench-richtext-body { padding: 10px 12px; min-height: 110px; outline: none; font-size: 14px; line-height: 1.6; }
.bench-richtext-body:empty::before { content: attr(data-placeholder); color: #98a2b3; }
.bench-richtext-body p { margin: 0 0 8px; }
.bench-richtext-body ul, .bench-richtext-body ol { margin: 0 0 8px; padding-left: 22px; }
.bench-richtext-body blockquote { margin: 0 0 8px; padding-left: 12px; border-left: 3px solid var(--border-strong); color: var(--text-muted); }
.bench-richtext-body code { background: #f2f4f7; padding: 1px 5px; border-radius: 4px; font-size: 13px; }

.bench-prose { font-size: 14px; line-height: 1.6; }
.bench-prose p { margin: 0 0 8px; }
.bench-prose ul, .bench-prose ol { margin: 0 0 8px; padding-left: 22px; }
.bench-prose h3 { font-size: 15px; margin: 12px 0 6px; }
.bench-prose h4 { font-size: 14px; margin: 10px 0 6px; }
.bench-prose blockquote { margin: 0 0 8px; padding-left: 12px; border-left: 3px solid var(--border-strong); color: var(--text-muted); }
.bench-prose a { color: var(--accent); }
.bench-prose :last-child { margin-bottom: 0; }

.bench-drop { display: flex; align-items: center; gap: 12px; border: 1px dashed var(--border-strong); border-radius: 8px; padding: 12px; background: var(--surface); }
.bench-drop-hint { color: var(--text-muted); font-size: 13px; }
.bench-thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); flex-shrink: 0; background: #f2f4f7; }
.bench-file-link { color: var(--accent); font-size: 13px; text-decoration: none; }
.bench-file-link:hover { text-decoration: underline; }
`.trimStart();

export const UI_SOURCE = String.raw`
import React, { useEffect, useRef, useState } from "react";
import { assetUrl, uploadFile, uploadImage } from "./db";

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="bench-page">{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="bench-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="bench-header-actions">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  children,
  flush,
}: {
  title?: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="bench-card">
      {title && <div className="bench-card-header">{title}</div>}
      <div className={flush ? "bench-card-body bench-flush" : "bench-card-body"}>{children}</div>
    </section>
  );
}

export function Grid({ children, cols }: { children: React.ReactNode; cols?: number }) {
  return (
    <div
      className="bench-grid"
      style={cols ? { gridTemplateColumns: "repeat(" + cols + ", minmax(0, 1fr))" } : undefined}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  /** Optional line under the number: a comparison, a caveat, a unit. */
  hint?: React.ReactNode;
}) {
  return (
    <div className="bench-stat">
      <div className="bench-stat-label">{label}</div>
      <div className="bench-stat-value">{value}</div>
      {hint && <div className="bench-stat-hint">{hint}</div>}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function Button({ variant = "default", size = "md", className, ...rest }: ButtonProps) {
  const classes = [
    "bench-btn",
    variant !== "default" ? "bench-btn-" + variant : "",
    size === "sm" ? "bench-btn-sm" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...rest} />;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="bench-field">
      <span className="bench-field-label">{label}</span>
      {children}
      {hint && !error && <span className="bench-field-hint">{hint}</span>}
      {error && <span className="bench-field-error">{error}</span>}
    </label>
  );
}

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="bench-input" {...props} />
);

export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className="bench-textarea" {...props} />
);

export function Select({
  options,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Convenience: pass values instead of writing option elements. */
  options?: (string | { value: string; label: string })[];
}) {
  return (
    <select className="bench-select" {...rest}>
      {options
        ? options.map((option) => {
            const value = typeof option === "string" ? option : option.value;
            const label = typeof option === "string" ? option : option.label;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })
        : children}
    </select>
  );
}

export function Checkbox({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="bench-checkbox">
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="bench-row">{children}</div>;
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="bench-toolbar">{children}</div>;
}

export function Spacer() {
  return <div className="bench-spacer" />;
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "ok" | "warn" | "danger";
}) {
  return (
    <span className={tone === "default" ? "bench-badge" : "bench-badge bench-badge-" + tone}>
      {children}
    </span>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right";
}

export function Table<T extends { id: string }>({
  columns,
  rows,
  actions,
  empty,
  loading,
}: {
  columns: Column<T>[];
  rows: T[];
  actions?: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
  /** Shows a placeholder instead of an empty table on first load. */
  loading?: boolean;
}) {
  if (loading && rows.length === 0) {
    return <div className="bench-empty">Loading...</div>;
  }
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <table className="bench-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} style={column.align === "right" ? { textAlign: "right" } : undefined}>
              {column.label}
            </th>
          ))}
          {actions && <th />}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td
                key={column.key}
                style={column.align === "right" ? { textAlign: "right" } : undefined}
              >
                {column.render ? column.render(row) : String((row as never)[column.key] ?? "")}
              </td>
            ))}
            {actions && <td className="bench-table-actions">{actions(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="bench-empty">
      <div className="bench-empty-title">{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}

export function Alert({
  children,
  tone = "danger",
}: {
  children: React.ReactNode;
  tone?: "danger" | "warn" | "ok" | "info";
}) {
  return <div className={"bench-alert bench-alert-" + tone}>{children}</div>;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  actions,
  open = true,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Alias for footer. */
  actions?: React.ReactNode;
  /** Defaults to true, so a conditionally rendered modal still works. */
  open?: boolean;
}) {
  // Both shapes are in use: mount the modal conditionally, or keep it mounted
  // and toggle "open". Supporting only the first leaves the second stuck open
  // with no way out.
  if (!open) return null;

  const buttons = footer ?? actions;

  return (
    <div className="bench-modal-backdrop" onClick={onClose}>
      <div className="bench-modal" onClick={(event) => event.stopPropagation()}>
        <div className="bench-modal-header">{title}</div>
        <div className="bench-modal-body">{children}</div>
        {buttons && <div className="bench-modal-footer">{buttons}</div>}
      </div>
    </div>
  );
}

/**
 * Rich text input. Stores HTML, which Bench sanitises on write against a strict
 * allowlist, so only formatting survives.
 *
 * Built on document.execCommand. It is deprecated and every browser still
 * implements it; a real editor would mean a dependency the sandbox does not
 * have, for formatting nobody needs beyond this.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Only write into the DOM when the incoming value genuinely differs, or every
  // keystroke would reset the caret to the start.
  useEffect(() => {
    const node = ref.current;
    if (node && node.innerHTML !== value) node.innerHTML = value || "";
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  const exec = (command: string, argument?: string) => {
    document.execCommand(command, false, argument);
    ref.current?.focus();
    emit();
  };

  const buttons: { label: React.ReactNode; title: string; run: () => void }[] = [
    { label: <b>B</b>, title: "Bold", run: () => exec("bold") },
    { label: <i>I</i>, title: "Italic", run: () => exec("italic") },
    { label: <u>U</u>, title: "Underline", run: () => exec("underline") },
    { label: "H", title: "Heading", run: () => exec("formatBlock", "<h3>") },
    { label: "\u2022", title: "Bullet list", run: () => exec("insertUnorderedList") },
    { label: "1.", title: "Numbered list", run: () => exec("insertOrderedList") },
    { label: "\u201C", title: "Quote", run: () => exec("formatBlock", "<blockquote>") },
    {
      label: "\ud83d\udd17",
      title: "Link",
      run: () => {
        const url = window.prompt("Link URL");
        if (url) exec("createLink", url);
      },
    },
    { label: "\u2715", title: "Clear formatting", run: () => exec("removeFormat") },
  ];

  return (
    <div className="bench-richtext">
      <div className="bench-richtext-toolbar">
        {buttons.map((button) => (
          <button
            key={button.title}
            type="button"
            title={button.title}
            className="bench-richtext-btn"
            onMouseDown={(event) => event.preventDefault()}
            onClick={button.run}
          >
            {button.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="bench-richtext-body"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
}

/** Renders stored rich text. The value was sanitised before it was stored. */
export function RichText({ html }: { html: string }) {
  if (!html) return <span className="bench-muted">\u2014</span>;
  return <div className="bench-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Thumbnail for a value stored in an "image" field. */
export function ImageThumb({ id, alt = "" }: { id: string | null | undefined; alt?: string }) {
  if (!id) return <div className="bench-thumb" />;
  return <img className="bench-thumb" src={assetUrl(id)} alt={alt} />;
}

/** Download link for a value stored in a "file" field. */
export function FileLink({ id, name = "Download" }: { id: string | null | undefined; name?: string }) {
  if (!id) return <span className="bench-muted">\u2014</span>;
  return (
    <a className="bench-file-link" href={assetUrl(id)} target="_blank" rel="noreferrer">
      {name}
    </a>
  );
}

/**
 * Picks an image, downscales it, uploads it, and hands back the asset id to
 * store in an "image" field.
 */
export function ImageUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      onChange(uploaded.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="bench-drop">
        <ImageThumb id={value} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(event) => pick(event.target.files?.[0])}
            style={{ fontSize: 13 }}
          />
          <div className="bench-drop-hint">
            {busy ? "Uploading..." : "PNG, JPEG, GIF or WebP"}
          </div>
        </div>
        {value && (
          <Button size="sm" variant="ghost" type="button" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      {error && <div className="bench-field-error">{error}</div>}
    </div>
  );
}

/** Same, for a "file" field: PDFs, spreadsheets, CSVs. */
export function FileUpload({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (id: string | null, name?: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadFile(file);
      onChange(uploaded.id, uploaded.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="bench-drop">
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="file"
            disabled={busy}
            onChange={(event) => pick(event.target.files?.[0])}
            style={{ fontSize: 13 }}
          />
          <div className="bench-drop-hint">
            {busy
              ? "Uploading..."
              : value
                ? <FileLink id={value} name={label ?? "View file"} />
                : "PDF, CSV, TXT, DOCX or XLSX"}
          </div>
        </div>
        {value && (
          <Button size="sm" variant="ghost" type="button" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      {error && <div className="bench-field-error">{error}</div>}
    </div>
  );
}
`.trimStart();
