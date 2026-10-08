"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

// An in-page color picker (no browser popup): a saturation/brightness square, a hue slider,
// quick swatches and a hex box. Works with mouse, touch and keyboard.

type HSV = { h: number; s: number; v: number };

const SWATCHES = [
  "#E8622C", "#F5B83D", "#C85F18", "#B7793F", "#E5484D", "#FF5C8A",
  "#FF73FA", "#A66BFF", "#5865F2", "#3E9BFF", "#2EC4B6", "#46A758",
  "#9BE15D", "#FFFFFF", "#B5BAC1", "#1F1F1F",
];

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

function hexToHsv(hex: string): HSV | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: HSV) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return "#" + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function useDrag(onMove: (x: number, y: number) => void) {
  return (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const update = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      onMove(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height));
    };
    update(e);
    const move = (ev: PointerEvent) => update(ev);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
}

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value) ?? { h: 20, s: 0.8, v: 0.9 });
  const [text, setText] = useState(value);
  const last = useRef(value);

  // Follow outside changes (another color tab, a saved design) without losing the hue on greys
  useEffect(() => {
    if (value.toUpperCase() === last.current.toUpperCase()) return;
    const next = hexToHsv(value);
    if (next) setHsv((cur) => (next.s === 0 || next.v === 0 ? { ...next, h: cur.h } : next));
    setText(value);
    last.current = value;
  }, [value]);

  const set = (next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next);
    last.current = hex;
    setText(hex);
    onChange(hex);
  };

  const onSV = useDrag((x, y) => set({ ...hsv, s: x, v: 1 - y }));
  const onHue = useDrag((x) => set({ ...hsv, h: x * 360 }));
  const current = hsvToHex(hsv);

  return (
    <div className="cp" aria-label={label}>
      <div
        className="cp-sv"
        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
        onPointerDown={onSV}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: saturation and brightness`}
        aria-valuetext={current}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          if (e.key === "ArrowRight") set({ ...hsv, s: clamp(hsv.s + step) });
          else if (e.key === "ArrowLeft") set({ ...hsv, s: clamp(hsv.s - step) });
          else if (e.key === "ArrowUp") set({ ...hsv, v: clamp(hsv.v + step) });
          else if (e.key === "ArrowDown") set({ ...hsv, v: clamp(hsv.v - step) });
          else return;
          e.preventDefault();
        }}
      >
        <span className="cp-sv-knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: current }} />
      </div>
      <div
        className="cp-hue"
        onPointerDown={onHue}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: hue`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 15 : 3;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") set({ ...hsv, h: (hsv.h + step) % 360 });
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") set({ ...hsv, h: (hsv.h - step + 360) % 360 });
          else return;
          e.preventDefault();
        }}
      >
        <span className="cp-hue-knob" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h}, 100%, 50%)` }} />
      </div>
      <div className="cp-swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={c === current ? "is-on" : ""}
            style={{ background: c }}
            onClick={() => {
              const next = hexToHsv(c);
              if (next) set(next.s === 0 ? { ...next, h: hsv.h } : next);
            }}
            aria-label={`Use ${c}`}
          />
        ))}
      </div>
      <label className="cp-hex">
        <span style={{ background: current }} aria-hidden="true" />
        <input
          value={text}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label} hex code`}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setText(v.toUpperCase());
            const next = hexToHsv(v);
            if (next) {
              setHsv(next.s === 0 ? { ...next, h: hsv.h } : next);
              last.current = v.toUpperCase();
              onChange(v.toUpperCase());
            }
          }}
        />
      </label>
    </div>
  );
}
