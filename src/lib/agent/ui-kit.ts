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

.bench-alert { padding: 12px 16px; border-radius: 8px; background: var(--danger-soft); color: var(--danger); border: 1px solid #fecdca; margin-bottom: 16px; }

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
`.trimStart();

export const UI_SOURCE = String.raw`
import React from "react";

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

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="bench-grid">{children}</div>;
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bench-stat">
      <div className="bench-stat-label">{label}</div>
      <div className="bench-stat-value">{value}</div>
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

export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className="bench-select" {...props} />
);

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
}: {
  columns: Column<T>[];
  rows: T[];
  actions?: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
}) {
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

export function Alert({ children }: { children: React.ReactNode }) {
  return <div className="bench-alert">{children}</div>;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bench-modal-backdrop" onClick={onClose}>
      <div className="bench-modal" onClick={(event) => event.stopPropagation()}>
        <div className="bench-modal-header">{title}</div>
        <div className="bench-modal-body">{children}</div>
        {footer && <div className="bench-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
`.trimStart();
