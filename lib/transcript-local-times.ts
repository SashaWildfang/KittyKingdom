// Transcripts print times in Mountain Time; this rewrites them into the viewer's time zone
// (older transcripts don't include it themselves).
export const LOCAL_TIMES_SCRIPT = `<script data-kk-local-times>${"(function () {\n  // Transcript times are written in Mountain Time (\"09/27/2026 \u2022 04:05 PM MT\"); show them in the viewer's time zone.\n  var RE = /(\\d{2})\\/(\\d{2})\\/(\\d{4}) \u2022 (\\d{2}):(\\d{2}) (AM|PM)( MT)?/g;\n  var partsFmt = new Intl.DateTimeFormat(\"en-US\", { timeZone: \"America/Denver\", hourCycle: \"h23\", year: \"numeric\", month: \"2-digit\", day: \"2-digit\", hour: \"2-digit\", minute: \"2-digit\" });\n  var out = new Intl.DateTimeFormat(undefined, { month: \"short\", day: \"numeric\", year: \"numeric\", hour: \"numeric\", minute: \"2-digit\", timeZoneName: \"short\" });\n  function fromMountain(y, mo, d, h, mi) {\n    var want = Date.UTC(y, mo - 1, d, h, mi);\n    var guess = want;\n    for (var i = 0; i < 3; i++) {\n      var p = {};\n      partsFmt.formatToParts(new Date(guess)).forEach(function (x) { p[x.type] = +x.value; });\n      guess += want - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);\n    }\n    return new Date(guess);\n  }\n  function convert(text) {\n    return text.replace(RE, function (_, mo, d, y, h, mi, ap) {\n      var hour = (+h % 12) + (ap === \"PM\" ? 12 : 0);\n      return out.format(fromMountain(+y, +mo, +d, hour, +mi));\n    });\n  }\n  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);\n  var nodes = [];\n  while (walker.nextNode()) nodes.push(walker.currentNode);\n  nodes.forEach(function (n) {\n    if (RE.test(n.nodeValue)) n.nodeValue = convert(n.nodeValue);\n    RE.lastIndex = 0;\n  });\n})();"}</script>`;

// The bot's time format: "09/27/2026 • 04:05 PM", sometimes followed by " MT"
const MT_TIME = /(\d{2})\/(\d{2})\/(\d{4}) • (\d{2}):(\d{2}) (AM|PM)(?: MT)?/g;
const denverParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

/** A Mountain Time wall-clock reading as a real moment. */
function fromMountain(y: number, mo: number, d: number, h: number, mi: number) {
  const want = Date.UTC(y, mo - 1, d, h, mi);
  let guess = want;
  for (let i = 0; i < 3; i++) {
    const p: Record<string, number> = {};
    denverParts.formatToParts(new Date(guess)).forEach((x) => (p[x.type] = Number(x.value)));
    guess += want - Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
  }
  return new Date(guess);
}

/**
 * Rewrites every transcript time into the viewer's time zone on the server ("Sep 27, 2026, 6:05 PM
 * EDT"), so it doesn't depend on the page's own script running.
 */
export function localizeTranscriptTimes(page: string, timeZone: string) {
  let out: Intl.DateTimeFormat;
  try {
    out = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  } catch {
    return page;
  }
  return page.replace(MT_TIME, (_all, mo: string, d: string, y: string, h: string, mi: string, ap: string) => {
    const hour = (Number(h) % 12) + (ap === "PM" ? 12 : 0);
    return out.format(fromMountain(Number(y), Number(mo), Number(d), hour, Number(mi)));
  });
}
