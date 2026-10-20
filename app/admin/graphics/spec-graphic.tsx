"use client";

// Draws any stat Spec from the server (lib/graphics/spec.ts) with the chart pieces in charts.tsx.

import type { ReactNode, Ref } from "react";
import type { Block, Spec } from "../../../lib/graphics/spec";
import { BarsBlock, ColumnsBlock, Graphic, HeatBlock, HeroBlock, LineBlock, seriesColor, StripBlock, TilesBlock, type Size, type Theme, type Tokens } from "./charts";

type Box = { x: number; y: number; w: number; h: number; t: Tokens; theme: Theme };

function drawBlock(b: Block, box: Box): ReactNode {
  const { t, theme } = box;
  const accent = seriesColor(theme, 0);
  if (b.kind === "bars" || b.kind === "leaderboard") {
    const rows = b.rows.map((r, i) => ({
      label: b.kind === "leaderboard" ? `${i + 1}.  ${r.label}` : r.label,
      count: r.value,
      note: r.note,
      color: r.muted ? (i % 2 ? t.gray2 : t.gray) : b.kind === "bars" && b.colorful ? seriesColor(theme, i) : b.kind === "leaderboard" && i < 3 ? ["#e8b923", "#b8c2cc", "#c98a4b"][i] : accent,
    }));
    const showPct = b.kind === "bars" && Boolean(b.total) && !b.format;
    return <BarsBlock {...box} rows={rows} total={b.kind === "bars" ? b.total ?? 0 : 0} title={b.title} format={b.format} showPct={showPct} />;
  }
  if (b.kind === "columns") return <ColumnsBlock {...box} cols={b.rows.map((r) => ({ label: r.label, count: r.value }))} title={b.title} color={accent} format={b.format} />;
  if (b.kind === "line") return <LineBlock {...box} labels={b.labels} series={b.series.slice(0, 4)} title={b.title} theme={theme} format={b.format} />;
  if (b.kind === "heat") return <HeatBlock {...box} rows={b.rows} cols={b.cols} cells={b.cells} totals={b.totals} title={b.title} accent={accent} byColumn={b.byColumn} />;
  if (b.kind === "strip") return <StripBlock {...box} rows={b.rows.map((r, i) => ({ label: r.label, count: r.value, color: r.muted ? (i % 2 ? t.gray2 : t.gray) : seriesColor(theme, i) }))} title={b.title} />;
  return <TilesBlock {...box} tiles={b.tiles} />;
}

/** Lays out tiles on top, then hero / main / side across, then a strip at the bottom. */
export function SpecGraphic({ spec, theme, size, title, subtitle, footnote, svgRef }: { spec: Spec; theme: Theme; size: Size; title?: string; subtitle?: string; footnote: boolean; svgRef?: Ref<SVGSVGElement> }) {
  const square = size === "square";
  return (
    <Graphic
      svgRef={svgRef}
      frame={{
        theme,
        size,
        eyebrow: spec.eyebrow ?? "Bear Nation",
        title: title?.trim() || spec.title,
        subtitle: subtitle?.trim() || spec.subtitle,
        stamp: `Snapshot · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}\nbear-nation.net`,
        footnote: footnote ? spec.footnote : "",
      }}
      body={(box) => {
        const gap = 26;
        let { y, h } = box;
        const parts: ReactNode[] = [];
        if (spec.tiles?.length) {
          const tiles = square ? spec.tiles.slice(0, 3) : spec.tiles.slice(0, 5);
          parts.push(<g key="tiles">{drawBlock({ kind: "tiles", tiles }, { ...box, y, h: 140 })}</g>);
          y += 140 + gap;
          h -= 140 + gap;
        }
        if (spec.bottom) {
          const bh = spec.bottom.kind === "strip" ? 170 : Math.min(320, h * 0.4);
          parts.push(<g key="bottom">{drawBlock(spec.bottom, { ...box, y: y + h - bh, h: bh })}</g>);
          h -= bh + gap;
        }
        const cols: { block?: Block; hero?: Spec["hero"]; weight: number }[] = [];
        if (spec.hero) cols.push({ hero: spec.hero, weight: 0.34 });
        cols.push({ block: spec.main, weight: 1 });
        if (spec.side) cols.push({ block: spec.side, weight: 0.62 });
        if (square && cols.length > 1) {
          // Stacked: hero gets a short band, the rest share the height
          const heroH = spec.hero ? Math.min(250, h * 0.32) : 0;
          let yy = y;
          const rest = cols.filter((c) => c.block);
          const each = (h - heroH - (spec.hero ? gap : 0) - gap * (rest.length - 1)) / rest.length;
          if (spec.hero) {
            parts.push(<HeroBlock key="hero" {...box} y={yy} h={heroH} label={spec.hero.label} big={spec.hero.big} small={spec.hero.small} caption={spec.hero.caption} />);
            yy += heroH + gap;
          }
          rest.forEach((c, i) => {
            parts.push(<g key={`b${i}`}>{drawBlock(c.block!, { ...box, y: yy, h: each })}</g>);
            yy += each + gap;
          });
        } else {
          const totalW = box.w - gap * (cols.length - 1);
          const sum = cols.reduce((a, c) => a + c.weight, 0);
          let xx = box.x;
          cols.forEach((c, i) => {
            const w = (totalW * c.weight) / sum;
            if (c.hero) parts.push(<HeroBlock key="hero" {...box} x={xx} y={y} w={w} h={h} label={c.hero.label} big={c.hero.big} small={c.hero.small} caption={c.hero.caption} />);
            else parts.push(<g key={`b${i}`}>{drawBlock(c.block!, { ...box, x: xx, y, w, h })}</g>);
            xx += w + gap;
          });
        }
        return <g>{parts}</g>;
      }}
    />
  );
}
