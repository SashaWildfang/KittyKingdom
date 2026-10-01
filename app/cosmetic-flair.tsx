import type { ReactNode } from "react";

// How store cosmetics are drawn (the looks are the .cos-* classes in globals.css).

/** An avatar or photo with an equipped frame around it (works on any corner radius). */
export function Framed({ frame, children, className }: { frame: string | null | undefined; children: ReactNode; className?: string }) {
  if (!frame) return <>{children}</>;
  return (
    <span className={`cos-frame cos-frame--${frame}${className ? ` ${className}` : ""}`}>
      {children}
      <span className="cos-frame-ring" aria-hidden="true" />
      {frame === "crown" ? <span className="cos-frame-crown" aria-hidden="true">♛</span> : null}
    </span>
  );
}

/** A name with an equipped name effect. */
export function FlairName({ nameplate, children, text }: { nameplate: string | null | undefined; children: ReactNode; text?: string }) {
  if (!nameplate) return <>{children}</>;
  return (
    <span className={`cos-name cos-name--${nameplate}`} data-text={text}>
      {children}
    </span>
  );
}

/** A banner layer: put it first inside a positioned card. */
export function FlairBanner({ banner, className }: { banner: string | null | undefined; className?: string }) {
  if (!banner) return null;
  return (
    <span className={`cos-banner cos-banner--${banner}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <span className="cos-banner-fx" />
    </span>
  );
}
