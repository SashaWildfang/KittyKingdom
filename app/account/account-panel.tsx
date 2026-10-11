import type { ReactNode } from "react";

/** A My Account card: icon, title, one-line description, an optional status chip, then the content. Always open. */
export function AccountPanel({
  id,
  icon,
  title,
  description,
  summary,
  tone,
  className,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  summary?: ReactNode;
  tone?: "danger";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`acct4-panel${tone ? ` acct4-panel--${tone}` : ""}${className ? ` ${className}` : ""}`} id={id}>
      <header className="acct4-panel-head">
        <span className="acct4-panel-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="acct4-panel-title">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {summary ? <span className="acct4-summary">{summary}</span> : null}
      </header>
      <div className="acct4-panel-body">{children}</div>
    </section>
  );
}
