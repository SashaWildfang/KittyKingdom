"use client";

import { Download } from "lucide-react";

/** Opens the browser's print dialog, where "Save as PDF" downloads the resume. */
export function PrintButton() {
  return (
    <button type="button" className="rs-print" onClick={() => window.print()}>
      <Download size={16} aria-hidden="true" /> Download PDF
    </button>
  );
}
