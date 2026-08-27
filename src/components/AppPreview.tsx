"use client";

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useCallback, useEffect, useRef } from "react";
import { assembleFiles } from "@/lib/agent/contract";
import { handleBridgeRequest, isBridgeRequest } from "@/lib/preview/protocol";
import type { FileMap } from "@/lib/types";

/** Sandpack keys files by absolute path; the rest of Bench does not. */
function toSandpackFiles(files: FileMap): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [path, content] of Object.entries(assembleFiles(files))) {
    mapped[`/${path}`] = content;
  }
  return mapped;
}

/**
 * Reports compile and runtime errors out of the sandbox, and reports recovery.
 *
 * Both directions matter: the error is what the self-healing loop feeds back to
 * the agent, and the success signal is what lets a stale banner clear once a
 * fix lands.
 */
function ErrorReporter({ onError }: { onError?: (message: string | null) => void }) {
  const { listen } = useSandpack();

  useEffect(() => {
    if (!onError) return;
    return listen((message) => {
      if (message.type === "action" && message.action === "show-error") {
        const detail = [message.title, message.message].filter(Boolean).join(": ");
        onError(detail || "Unknown error in the generated app");
      } else if (message.type === "success") {
        onError(null);
      }
    });
  }, [listen, onError]);

  return null;
}

export function AppPreview({
  projectId,
  files,
  onError,
}: {
  projectId: string;
  files: FileMap;
  onError?: (message: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isFromPreview = useCallback((source: MessageEventSource | null) => {
    const container = containerRef.current;
    if (!container || !source) return false;
    return Array.from(container.querySelectorAll("iframe")).some(
      (frame) => frame.contentWindow === source,
    );
  }, []);

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (!isBridgeRequest(event.data)) return;
      // The generated app posts with targetOrigin "*" because it cannot know
      // ours. Trust is established the other way round: only a frame we are
      // actually rendering gets served.
      if (!isFromPreview(event.source)) return;

      const response = await handleBridgeRequest(projectId, event.data);
      (event.source as Window).postMessage(response, "*");
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [projectId, isFromPreview]);

  const hasApp = Object.keys(files).length > 0;

  if (!hasApp) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted">
        <div>
          <p className="mb-1 text-foreground">Nothing built yet</p>
          <p>Describe the tool you want and the agent will build it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bench-preview h-full min-h-0">
      <SandpackProvider
        template="react-ts"
        theme="light"
        files={toSandpackFiles(files)}
        options={{ recompileMode: "delayed", recompileDelay: 400 }}
      >
        <ErrorReporter onError={onError} />
        {/* Sandpack's layout is fixed-height by default, which leaves the
            generated app in a short letterbox; see also the .sp-* overrides in
            globals.css. */}
        <SandpackLayout style={{ height: "100%", border: "none", borderRadius: 0 }}>
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton
            showSandpackErrorOverlay
            style={{ height: "100%", minHeight: 0, flex: 1 }}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
