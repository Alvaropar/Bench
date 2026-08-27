/**
 * Source of `bench/router.tsx`, injected into every generated app.
 *
 * Hash routing, not the History API. Generated apps run inside a sandboxed
 * iframe: pushState there either fights the parent's router or throws on a
 * cross-origin sandbox. The hash is owned entirely by the frame, survives the
 * preview reloading, and still gives every screen an addressable URL.
 */
export const ROUTER_SOURCE = String.raw`
import React, { useCallback, useEffect, useMemo, useState } from "react";

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  const raw = window.location.hash.replace(/^#/, "");
  return raw.startsWith("/") ? raw : "/" + raw;
}

/**
 * The active path, e.g. "/customers/42".
 *
 * Listens to hashchange, so the browser's back and forward buttons work inside
 * the app without any extra wiring.
 */
export function useRoute(): {
  path: string;
  navigate: (to: string) => void;
  back: () => void;
} {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to.startsWith("/") ? to : "/" + to;
  }, []);

  const back = useCallback(() => window.history.back(), []);

  return { path, navigate, back };
}

/**
 * Matches a pattern against the active path and returns its parameters.
 *
 *   useParams("/customers/:id")  ->  { id: "42" }  or  null when it does not match
 */
export function useParams(pattern: string): Record<string, string> | null {
  const { path } = useRoute();
  return useMemo(() => matchPath(pattern, path), [pattern, path]);
}

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index++) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

/** Renders its children only when the pattern matches the active path. */
export function Route({
  path: pattern,
  children,
}: {
  path: string;
  children: React.ReactNode | ((params: Record<string, string>) => React.ReactNode);
}) {
  const { path } = useRoute();
  const params = matchPath(pattern, path);
  if (!params) return null;
  return <>{typeof children === "function" ? children(params) : children}</>;
}

/**
 * Renders the first matching Route, like a switch.
 *
 * Put the most specific patterns first; "/customers/:id" must come before "/".
 */
export function Routes({ children }: { children: React.ReactNode }) {
  const { path } = useRoute();

  const matched = React.Children.toArray(children).find((child) => {
    if (!React.isValidElement<{ path?: string }>(child)) return false;
    const pattern = child.props.path;
    return typeof pattern === "string" && matchPath(pattern, path) !== null;
  });

  return <>{matched ?? null}</>;
}

/** An anchor that routes internally instead of reloading the frame. */
export function Link({
  to,
  children,
  className,
  style,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { navigate } = useRoute();
  return (
    <a
      href={"#" + (to.startsWith("/") ? to : "/" + to)}
      className={className}
      style={style}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

/** Top-level tabs bound to routes, the common shape for a multi-screen tool. */
export function NavTabs({
  items,
}: {
  items: { to: string; label: string }[];
}) {
  const { path, navigate } = useRoute();

  return (
    <nav className="bench-navtabs">
      {items.map((item) => {
        const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
        return (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className={active ? "bench-navtab bench-navtab-active" : "bench-navtab"}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
`.trimStart();

/** Styles for the router's NavTabs, appended to the injected stylesheet. */
export const ROUTER_STYLES = String.raw`
.bench-navtabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: #eef0f4;
  border-radius: 9px;
  margin-bottom: 20px;
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
}

.bench-navtab {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}

.bench-navtab:hover {
  color: var(--text);
}

.bench-navtab-active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
`;
