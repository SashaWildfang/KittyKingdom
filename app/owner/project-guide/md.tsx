import { Fragment, type ReactNode } from "react";

/** **bold** and `code`, the only formatting the guide uses */
export function Md({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={`t${last}`}>{text.slice(last, m.index)}</Fragment>);
    out.push(m[1] !== undefined ? <b key={m.index}><Md text={m[1]} /></b> : <code key={m.index}>{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);
  return <>{out}</>;
}
