/**
 * Source of `bench/charts.tsx`, injected into every generated app.
 *
 * Hand-rolled inline SVG rather than a charting library: nothing is installed in
 * the sandbox, so a dependency would mean shipping a bundle into every generated
 * app. Four primitives cover what an internal tool actually needs, and because
 * they live in the fixed kit the agent composes them instead of inventing a
 * different chart every run.
 */
export const CHARTS_SOURCE = String.raw`
import React from "react";

export interface Point {
  label: string;
  value: number;
}

/** Categorical palette, tuned against the light surface generated apps use. */
const PALETTE = [
  "#3b5bdb",
  "#0ca678",
  "#f08c00",
  "#e03131",
  "#7048e8",
  "#0c8599",
  "#d6336c",
  "#5c940d",
];

export function chartColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / magnitude) * magnitude;
}

function format(value: number): string {
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (Math.abs(value) >= 1_000) return (value / 1_000).toFixed(1) + "k";
  return String(Math.round(value * 100) / 100);
}

function Empty({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      No data yet
    </div>
  );
}

/**
 * Vertical bars. Use for counts or totals across a handful of categories --
 * status breakdowns, spend per category, tickets per assignee.
 */
export function BarChart({
  data,
  height = 220,
  color,
  valueFormat = format,
}: {
  data: Point[];
  height?: number;
  /** One colour for all bars, or omit to colour each bar from the palette. */
  color?: string;
  valueFormat?: (value: number) => string;
}) {
  if (data.length === 0) return <Empty height={height} />;

  const max = niceCeiling(Math.max(...data.map((point) => point.value), 0));
  const plotHeight = height - 46;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          height: plotHeight,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {data.map((point, index) => {
          const ratio = max === 0 ? 0 : point.value / max;
          return (
            <div
              key={point.label}
              style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
              title={point.label + ": " + valueFormat(point.value)}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  marginBottom: 4,
                  whiteSpace: "nowrap",
                }}
              >
                {valueFormat(point.value)}
              </div>
              <div
                style={{
                  height: Math.max(2, ratio * (plotHeight - 22)),
                  background: color ?? chartColor(index),
                  borderRadius: "5px 5px 0 0",
                  transition: "height 0.25s ease-out",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        {data.map((point) => (
          <div
            key={point.label}
            style={{
              flex: 1,
              fontSize: 11,
              color: "var(--text-muted)",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={point.label}
          >
            {point.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A trend over ordered points. Use for anything against time -- revenue by
 * month, tickets opened per week.
 */
export function LineChart({
  data,
  height = 220,
  color = PALETTE[0],
  valueFormat = format,
}: {
  data: Point[];
  height?: number;
  color?: string;
  valueFormat?: (value: number) => string;
}) {
  if (data.length === 0) return <Empty height={height} />;

  const width = 600;
  const plotHeight = height - 34;
  const padding = { top: 12, right: 8, bottom: 8, left: 8 };
  const max = niceCeiling(Math.max(...data.map((point) => point.value), 0));
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = plotHeight - padding.top - padding.bottom;

  const x = (index: number) =>
    padding.left + (data.length === 1 ? usableWidth / 2 : (index / (data.length - 1)) * usableWidth);
  const y = (value: number) =>
    padding.top + usableHeight - (max === 0 ? 0 : (value / max) * usableHeight);

  const line = data.map((point, index) => (index === 0 ? "M" : "L") + x(index) + " " + y(point.value)).join(" ");
  const area =
    line + " L " + x(data.length - 1) + " " + (padding.top + usableHeight) +
    " L " + x(0) + " " + (padding.top + usableHeight) + " Z";

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={"0 0 " + width + " " + plotHeight}
        preserveAspectRatio="none"
        style={{ width: "100%", height: plotHeight, display: "block", overflow: "visible" }}
      >
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + usableHeight * fraction}
            y2={padding.top + usableHeight * fraction}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        <path d={area} fill={color} opacity={0.1} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((point, index) => (
          <circle key={point.label} cx={x(index)} cy={y(point.value)} r={3} fill={color}>
            <title>{point.label + ": " + valueFormat(point.value)}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {data.map((point) => (
          <span key={point.label} style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Share of a whole. Use for status or category splits, not for many slices. */
export function DonutChart({
  data,
  size = 180,
  valueFormat = format,
}: {
  data: Point[];
  size?: number;
  valueFormat?: (value: number) => string;
}) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  if (data.length === 0 || total === 0) return <Empty height={size} />;

  const radius = size / 2;
  const thickness = size * 0.22;
  const circumference = 2 * Math.PI * (radius - thickness / 2);

  let offset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{ flexShrink: 0 }}>
        <g transform={"rotate(-90 " + radius + " " + radius + ")"}>
          {data.map((point, index) => {
            const fraction = point.value / total;
            const dash = fraction * circumference;
            const element = (
              <circle
                key={point.label}
                cx={radius}
                cy={radius}
                r={radius - thickness / 2}
                fill="none"
                stroke={chartColor(index)}
                strokeWidth={thickness}
                strokeDasharray={dash + " " + (circumference - dash)}
                strokeDashoffset={-offset}
              >
                <title>{point.label + ": " + valueFormat(point.value)}</title>
              </circle>
            );
            offset += dash;
            return element;
          })}
        </g>
        <text
          x={radius}
          y={radius - 2}
          textAnchor="middle"
          style={{ fontSize: 20, fontWeight: 600, fill: "var(--text)" }}
        >
          {valueFormat(total)}
        </text>
        <text
          x={radius}
          y={radius + 16}
          textAnchor="middle"
          style={{ fontSize: 11, fill: "var(--text-muted)" }}
        >
          total
        </text>
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        {data.map((point, index) => (
          <div key={point.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: chartColor(index),
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--text)" }}>{point.label}</span>
            <span style={{ color: "var(--text-muted)" }}>
              {valueFormat(point.value)} ({Math.round((point.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A tiny inline trend, sized to sit inside a Stat card. */
export function Sparkline({
  values,
  width = 90,
  height = 26,
  color = PALETTE[0],
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return x + "," + y;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Groups rows by a field and counts them -- the shape every one of these charts
 * wants, and the thing most likely to be written subtly wrong by hand.
 */
export function countBy<T extends Record<string, unknown>>(
  rows: T[],
  field: keyof T,
): Point[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row[field] === null || row[field] === undefined ? "None" : String(row[field]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

/** Sums a numeric field, grouped by another field. */
export function sumBy<T extends Record<string, unknown>>(
  rows: T[],
  groupField: keyof T,
  valueField: keyof T,
): Point[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key =
      row[groupField] === null || row[groupField] === undefined
        ? "None"
        : String(row[groupField]);
    totals.set(key, (totals.get(key) ?? 0) + (Number(row[valueField]) || 0));
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value }));
}
`.trimStart();
