/**
 * Source of `bench/inspect.ts`, injected into every generated app.
 *
 * Click-to-edit: the parent turns on select mode, the user clicks something in
 * the running app, and a description of that element goes back to the agent.
 *
 * The hard part of this feature is normally mapping a DOM node to a source
 * location, which means a Babel plugin stamping every element with its file and
 * line. Bench sidesteps it: the agent already has the full source in context,
 * so a good *description* -- tag, classes, visible text, and the chain of
 * ancestors -- is enough for it to find the right JSX. Cheaper, and it survives
 * the agent restructuring the code.
 */
export const INSPECT_SOURCE = String.raw`
interface PickedElement {
  tag: string;
  className: string;
  text: string;
  path: string;
  attributes: string;
}

const HIGHLIGHT_ID = "__bench_inspect_highlight";

let enabled = false;
let highlight: HTMLDivElement | null = null;

function ensureHighlight(): HTMLDivElement {
  if (highlight) return highlight;
  highlight = document.createElement("div");
  highlight.id = HIGHLIGHT_ID;
  Object.assign(highlight.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "2147483647",
    border: "2px solid #3b5bdb",
    background: "rgba(59, 91, 219, 0.12)",
    borderRadius: "4px",
    transition: "all 0.05s linear",
    display: "none",
  } as CSSStyleDeclaration);
  document.body.appendChild(highlight);
  return highlight;
}

function describe(element: Element): PickedElement {
  const chain: string[] = [];
  let node: Element | null = element;

  for (let depth = 0; node && depth < 5; depth++) {
    const classes = typeof node.className === "string" ? node.className.trim() : "";
    chain.unshift(node.tagName.toLowerCase() + (classes ? "." + classes.split(/\s+/).join(".") : ""));
    node = node.parentElement;
  }

  const interesting = ["placeholder", "type", "href", "alt", "title", "aria-label"];
  const attributes = interesting
    .map((name) => {
      const value = element.getAttribute(name);
      return value ? name + '="' + value + '"' : null;
    })
    .filter(Boolean)
    .join(" ");

  return {
    tag: element.tagName.toLowerCase(),
    className: typeof element.className === "string" ? element.className : "",
    text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 160),
    path: chain.join(" > "),
    attributes,
  };
}

function onMove(event: MouseEvent) {
  if (!enabled) return;
  const target = event.target as Element | null;
  if (!target || target.id === HIGHLIGHT_ID) return;

  const box = target.getBoundingClientRect();
  const overlay = ensureHighlight();
  overlay.style.display = "block";
  overlay.style.top = box.top + "px";
  overlay.style.left = box.left + "px";
  overlay.style.width = box.width + "px";
  overlay.style.height = box.height + "px";
}

function onClick(event: MouseEvent) {
  if (!enabled) return;
  event.preventDefault();
  event.stopPropagation();

  const target = event.target as Element | null;
  if (!target) return;

  window.parent.postMessage(
    { __bench: "picked", element: describe(target) },
    "*",
  );
  setEnabled(false);
}

function onKey(event: KeyboardEvent) {
  if (enabled && event.key === "Escape") {
    window.parent.postMessage({ __bench: "picked", element: null }, "*");
    setEnabled(false);
  }
}

function setEnabled(next: boolean) {
  enabled = next;
  document.body.style.cursor = next ? "crosshair" : "";
  if (!next && highlight) highlight.style.display = "none";
}

if (typeof window !== "undefined") {
  // Capture phase: the generated app's own handlers must not see the click that
  // is selecting one of its elements.
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);

  window.addEventListener("message", (event: MessageEvent) => {
    const message = event.data;
    if (!message || message.__bench !== "inspect") return;
    setEnabled(Boolean(message.enabled));
  });
}

export {};
`.trimStart();
