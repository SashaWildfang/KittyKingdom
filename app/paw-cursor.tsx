"use client";

import { useEffect, useState } from "react";

export function PawCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    function onMove(event: MouseEvent) {
      setPosition({ x: event.clientX, y: event.clientY });
      const target = event.target as HTMLElement | null;
      setActive(
        Boolean(
          target?.closest("a,button,input,label,.cta,.ghost,.form-button"),
        ),
      );
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`paw-cursor${active ? " paw-cursor-active" : ""}`}
      style={{ left: position.x, top: position.y }}
    >
      <svg viewBox="0 0 64 64">
        <g>
          <ellipse cx="19" cy="21" rx="6" ry="8" />
          <ellipse cx="32" cy="16" rx="6" ry="8" />
          <ellipse cx="45" cy="21" rx="6" ry="8" />
          <ellipse cx="49" cy="34" rx="5" ry="7" />
          <path d="M16 47c0-10 8-17 16-17s16 7 16 17c0 7-5 10-11 7-2-1-3-2-5-2s-3 1-5 2c-6 3-11 0-11-7Z" />
        </g>
      </svg>
    </div>
  );
}
