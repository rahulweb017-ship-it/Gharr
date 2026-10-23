"use client";

import { useId, useMemo, useState } from "react";
import { formatINRCompact } from "@/shared/money";
import { Money } from "@/components/ui/Money";

/**
 * One daily column chart (inline SVG, no chart library).
 *
 * Orders and GMV are different measures on different scales, so the dashboard
 * draws two of these one above the other rather than one dual-axis chart. Each
 * is a single series: the heading names it, so there is no legend box.
 *
 * Marks follow the dataviz spec: columns capped at 24px with a 2px gap, a 4px
 * rounded data end, hairline solid gridlines, only the peak labelled directly.
 * Hover or arrow keys show the day's value; the same numbers are in the table.
 */

export interface DailyValue {
  day: string; // YYYY-MM-DD (IST)
  value: number;
}

const W = 720;
const PLOT_H = 160;
const TOP = 18; // room for the peak label
const AXIS_H = 22;
const LEFT = 52;
const RIGHT = 8;
const H = TOP + PLOT_H + AXIS_H;

// Categorical slot 1 of the validated reference palette (passes on the light surface).
const SERIES = "#2a78d6";
const SERIES_ACTIVE = "#1c5bab";
const GRID = "#eaeef6"; // ink-100
const AXIS_TEXT = "#7d8fb3"; // ink-400

function niceStep(max: number, ticks: number) {
  const raw = Math.max(max, 1) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function DailyChart({
  title,
  data,
  kind,
}: {
  title: string;
  data: DailyValue[];
  kind: "count" | "paise";
}) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  const fmt = (v: number) => (kind === "paise" ? <Money paise={v} /> : v.toLocaleString("en-IN"));
  const fmtTick = (v: number) => (kind === "paise" ? formatINRCompact(v) : v.toLocaleString("en-IN"));

  const geo = useMemo(() => {
    const max = Math.max(0, ...data.map((d) => d.value));
    // Whole-unit ticks: counts in 1s, money in whole rupees.
    const unit = kind === "paise" ? 100 : 1;
    const step = Math.max(unit, Math.ceil(niceStep(max, 4) / unit) * unit);
    const top = Math.max(step, Math.ceil(max / step) * step);
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
    const plotW = W - LEFT - RIGHT;
    const band = plotW / Math.max(1, data.length);
    const barW = Math.max(1, Math.min(24, band - 2));
    const y = (v: number) => TOP + PLOT_H - (v / top) * PLOT_H;
    const x = (i: number) => LEFT + i * band + (band - barW) / 2;
    const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best), 0);
    return { top, ticks, band, barW, y, x, peak, max };
  }, [data, kind]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  function bar(i: number, v: number) {
    if (v <= 0) return null;
    const x0 = geo.x(i);
    const y0 = geo.y(v);
    const h = TOP + PLOT_H - y0;
    const r = Math.min(4, geo.barW / 2, h);
    // Rounded data end, square at the baseline.
    const d = `M${x0},${TOP + PLOT_H} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + geo.barW - r} Q${x0 + geo.barW},${y0} ${x0 + geo.barW},${y0 + r} V${TOP + PLOT_H} Z`;
    return <path key={i} d={d} fill={active === i ? SERIES_ACTIVE : SERIES} />;
  }

  function indexFromPointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor((px - LEFT) / geo.band);
    return i >= 0 && i < data.length ? i : null;
  }

  const current = active != null ? data[active] : null;

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink-900">{title}</span>
        <span className="text-xs text-ink-500">
          Total <span className="font-semibold text-ink-800">{fmt(total)}</span>
        </span>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          role="img"
          aria-label={`${title}. Use arrow keys to read each day. Full values are in the table below.`}
          aria-describedby={tableId}
          tabIndex={0}
          onPointerMove={(e) => setActive(indexFromPointer(e))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const dir = e.key === "ArrowRight" ? 1 : -1;
              setActive((a) => Math.min(data.length - 1, Math.max(0, (a ?? (dir > 0 ? -1 : data.length)) + dir)));
            }
          }}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={W - RIGHT} y1={geo.y(t)} y2={geo.y(t)} stroke={GRID} strokeWidth={1} />
              <text x={LEFT - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} className="tabular">
                {fmtTick(t)}
              </text>
            </g>
          ))}

          {active != null && (
            <rect x={LEFT + active * geo.band} y={TOP} width={geo.band} height={PLOT_H} fill="#f5f7fb" />
          )}
          {data.map((d, i) => bar(i, d.value))}

          {geo.max > 0 && (
            <text
              x={geo.x(geo.peak) + geo.barW / 2}
              y={geo.y(data[geo.peak].value) - 6}
              textAnchor={geo.peak > data.length * 0.85 ? "end" : geo.peak < data.length * 0.15 ? "start" : "middle"}
              fontSize={11}
              fontWeight={600}
              fill="#243b6b"
            >
              {fmtTick(data[geo.peak].value)}
            </text>
          )}

          {labelIdx.map((i) => (
            <text
              key={i}
              x={LEFT + i * geo.band + geo.band / 2}
              y={TOP + PLOT_H + 15}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fontSize={11}
              fill={AXIS_TEXT}
            >
              {dayLabel(data[i].day)}
            </text>
          ))}
        </svg>

        {current && active != null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs shadow-(--shadow-raised)"
            style={{ left: `${Math.min(88, Math.max(12, ((LEFT + (active + 0.5) * geo.band) / W) * 100))}%` }}
          >
            <p className="text-sm font-bold text-ink-900 tabular">{fmt(current.value)}</p>
            <p className="flex items-center gap-1.5 text-ink-500">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES }} />
              {dayLabel(current.day)}
            </p>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-ink-500">
        <summary className="cursor-pointer font-semibold hover:text-ink-800">View as table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-ink-100">
          <table id={tableId} className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink-50 text-ink-500">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-semibold">Day</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">{kind === "paise" ? "GMV" : "Orders"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 text-ink-800">
              {data.map((d) => (
                <tr key={d.day}>
                  <td className="px-3 py-1">{dayLabel(d.day)}</td>
                  <td className="px-3 py-1 text-right tabular">{fmt(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
