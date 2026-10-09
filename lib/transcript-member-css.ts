// The ticket transcript stylesheet. The website draws every transcript (staff and member copies, old and
// new) with it, and the ticket bot writes the same file into each transcript zip
// (TIcketing/ticketing/ticket_controls.py CSS_CONTENT, byte for byte), so downloads look the same.
// The accent colour comes from --accent (Admin → Bots → Ticket Bot → Transcripts).
export const TRANSCRIPT_CSS = `/* Kitty Kingdom ticket transcript */
:root {
  --accent: #ff8b3d;
  --radius: 16px;
  color-scheme: dark;
}
:root, [data-theme="dark"] {
  --bg: #111214;
  --bg-2: #18191c;
  --panel: #1e1f22;
  --panel-2: #2b2d31;
  --hover: rgba(255, 255, 255, 0.035);
  --line: rgba(255, 255, 255, 0.08);
  --line-2: rgba(255, 255, 255, 0.14);
  --text: #e3e5e8;
  --strong: #ffffff;
  --muted: #949ba4;
  --link: #00a8fc;
  --mention: rgba(88, 101, 242, 0.3);
  --mention-text: #c9cdfb;
  --shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
}
[data-theme="light"] {
  color-scheme: light;
  --bg: #f2f3f5;
  --bg-2: #e9eaed;
  --panel: #ffffff;
  --panel-2: #f2f3f5;
  --hover: rgba(0, 0, 0, 0.035);
  --line: rgba(0, 0, 0, 0.08);
  --line-2: rgba(0, 0, 0, 0.14);
  --text: #2e3338;
  --strong: #060607;
  --muted: #5c5e66;
  --link: #006ce7;
  --mention: rgba(88, 101, 242, 0.15);
  --mention-text: #4752c4;
  --shadow: 0 14px 40px rgba(0, 0, 0, 0.08);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 84px; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 "gg sans", "Inter", "Noto Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--link); }
svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* Top bar */
.tx-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(14px);
}
.tx-bar-in {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 1320px;
  margin: 0 auto;
  padding: 12px 24px;
}
.tx-brand { display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; min-width: 0; }
.tx-logo {
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000));
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.tx-brand-text { display: grid; line-height: 1.2; min-width: 0; }
.tx-brand-text small { color: var(--muted); font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-brand-text b { color: var(--strong); font-size: 15px; }
.tx-search {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  max-width: 520px;
  margin-left: auto;
  border: 1px solid var(--line-2);
  border-radius: 12px;
  background: var(--panel);
  color: var(--muted);
  padding: 0 10px 0 12px;
}
.tx-search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
.tx-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  outline: none;
  padding: 9px 0;
}
.tx-search input::-webkit-search-cancel-button { display: none; }
#searchCount { color: var(--accent); font-size: 12px; font-weight: 700; white-space: nowrap; }
.tx-search kbd {
  border: 1px solid var(--line-2);
  border-radius: 5px;
  color: var(--muted);
  font: 600 11px ui-monospace, monospace;
  padding: 1px 6px;
}
.tx-bar-actions { display: flex; gap: 6px; }
.tx-icon-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line-2);
  border-radius: 12px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
}
.tx-icon-btn:hover { border-color: var(--accent); color: var(--accent); }

/* Page */
.tx-page { max-width: 1320px; margin: 0 auto; padding: 24px 24px 64px; }

/* Summary */
.tx-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 22px;
  background:
    radial-gradient(700px 260px at 0% 0%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%),
    var(--panel);
  box-shadow: var(--shadow);
  padding: 28px;
  margin-bottom: 18px;
}
.tx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.tx-chip {
  border: 1px solid var(--line-2);
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  padding: 3px 11px;
}
.tx-chip.is-accent { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.tx-chip.is-danger { border-color: rgba(242, 63, 67, 0.55); background: rgba(242, 63, 67, 0.12); color: #ff7b7e; }
.tx-chip.is-closed { border-color: rgba(35, 165, 90, 0.5); background: rgba(35, 165, 90, 0.12); color: #3ddc84; }
.tx-hero h1 { margin: 0; color: var(--strong); font-size: clamp(24px, 3.4vw, 34px); line-height: 1.15; letter-spacing: -0.02em; }
.tx-sub { margin: 8px 0 22px; color: var(--muted); }
.tx-sub b { color: var(--text); }
.tx-timeline { display: flex; flex-wrap: wrap; gap: 0; margin: 0; padding: 0; list-style: none; }
.tx-timeline li {
  position: relative;
  display: grid;
  flex: 1 1 140px;
  gap: 1px;
  padding: 0 14px 0 0;
}
.tx-timeline li::before {
  content: "";
  position: absolute;
  top: 6px;
  left: 14px;
  right: 0;
  border-top: 2px solid var(--line-2);
}
.tx-timeline li:last-child::before { display: none; }
.tx-timeline li.is-done::before { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.tx-dot {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  margin-bottom: 8px;
  border: 2px solid var(--line-2);
  border-radius: 50%;
  background: var(--panel);
}
.tx-timeline li.is-done .tx-dot { border-color: var(--accent); background: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent); }
.tx-timeline li.is-danger .tx-dot { border-color: #f23f43; background: #f23f43; box-shadow: 0 0 0 4px rgba(242, 63, 67, 0.2); }
.tx-timeline b { color: var(--strong); font-size: 13px; }
.tx-timeline small { color: var(--muted); font-size: 12px; }
.tx-hero-stats { display: grid; grid-template-columns: repeat(2, minmax(110px, 1fr)); gap: 10px; align-self: center; }
.tx-hero-stats div {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg) 45%, transparent);
  padding: 12px 16px;
}
.tx-hero-stats b { display: block; color: var(--strong); font-size: 22px; line-height: 1.1; }
.tx-hero-stats small { color: var(--muted); font-size: 12px; font-weight: 600; }
.member-note {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 9%, var(--panel));
  font-size: 14px;
  padding: 12px 16px;
}
.member-note svg { flex: none; color: var(--accent); }
.header-times, .escalated-status { display: none; }

/* Conversation + side column */
.tx-grid { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 18px; align-items: start; }
.tx-chat {
  /* clip, not hidden: hidden would make the sticky day headers stick inside this box */
  overflow: clip;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--panel);
  box-shadow: var(--shadow);
  padding: 6px 0 4px;
}
.day-divider {
  position: sticky;
  top: 64px;
  z-index: 2;
  display: flex;
  justify-content: center;
  margin: 12px 0 4px;
  pointer-events: none;
}
.day-divider span {
  border: 1px solid var(--line-2);
  border-radius: 999px;
  background: var(--panel-2);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  padding: 3px 12px;
}
.msg {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 8px 22px 8px 18px;
  margin-top: 6px;
  border-left: 3px solid transparent;
  scroll-margin-top: 90px;
}
.msg:hover { background: var(--hover); }
.msg:target { background: color-mix(in srgb, var(--accent) 12%, transparent); border-left-color: var(--accent); }
.msg.is-staff { border-left-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.msg.is-continued { margin-top: 0; padding-top: 2px; padding-bottom: 2px; }
.msg.is-continued .avatar { visibility: hidden; height: 0; }
.msg.is-continued .author { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.msg.is-hidden { display: none; }
body.is-filtering .msg.is-continued .avatar { visibility: visible; height: 40px; }
body.is-filtering .msg.is-continued .author { position: static; width: auto; height: auto; clip: auto; }
.avatar, .participant-avatar-fallback.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--panel-2);
}
.participant-avatar-fallback {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 35%, var(--panel-2)) !important;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}
.msg-content { flex: 1; min-width: 0; }
.author { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--strong); font-size: 15px; font-weight: 700; }
.timestamp { color: var(--muted); font-size: 12px; font-weight: 500; }
.content { margin-top: 1px; white-space: pre-wrap; overflow-wrap: anywhere; }
.content:empty { display: none; }
.content code, .embed-box code {
  border-radius: 5px;
  background: var(--panel-2);
  font: 0.86em ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 2px 5px;
}
.content pre { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-2); padding: 10px 12px; }
.content blockquote { margin: 4px 0; border-left: 4px solid var(--line-2); padding-left: 10px; }
.chat-emoji { width: 1.375em; height: 1.375em; vertical-align: bottom; object-fit: contain; }
.mention, a.mention { border-radius: 4px; background: var(--mention); color: var(--mention-text); font-weight: 600; padding: 0 3px; text-decoration: none; }
.mention:hover { background: #5865f2; color: #fff; }
mark { border-radius: 3px; background: color-mix(in srgb, var(--accent) 45%, transparent); color: inherit; padding: 0 2px; }

/* Badges */
.staff-badge, .staff-team-badge, .claimer-badge {
  border-radius: 6px;
  color: #111;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 2px 7px;
  text-transform: uppercase;
  white-space: nowrap;
}
.staff-badge, .staff-team-badge, .badge-default { background: var(--accent); }
.badge-owner { background: #a678f2 !important; color: #fff !important; }
.badge-admin { background: #ff7b7b !important; color: #fff !important; }
.badge-mod { background: #57f287 !important; color: #111 !important; }
.badge-helper { background: #fee75c !important; color: #111 !important; }
.claimer-badge { background: #5865f2; color: #fff; }

/* Replies, forwards, reactions, buttons */
.reply-line {
  position: relative;
  margin-bottom: 2px;
  overflow: hidden;
  color: var(--muted);
  font-size: 13px;
  padding-left: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reply-line::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 9px;
  width: 16px;
  height: 9px;
  border-left: 2px solid var(--line-2);
  border-top: 2px solid var(--line-2);
  border-top-left-radius: 7px;
}
.reply-line b { color: var(--text); }
.forwarded { margin-top: 6px; border-left: 3px solid var(--line-2); padding-left: 12px; }
.forwarded-label { color: var(--muted); font-size: 12px; font-style: italic; }
.reactions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.reaction {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line-2);
  border-radius: 9px;
  background: var(--panel-2);
  font-size: 13px;
  padding: 2px 9px;
}
.reaction .chat-emoji { width: 18px; height: 18px; }
.reaction-users { display: block; width: 100%; color: var(--muted); font-size: 11px; margin-top: 2px; }
.button-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.discord-button { border-radius: 8px; color: #fff; font-size: 14px; font-weight: 600; padding: 6px 14px; }
.btn-primary { background: #5865f2; }
.btn-secondary { background: #4e5058; }
.btn-success { background: #248046; }
.btn-danger { background: #da373c; }

/* Embeds and media */
.embed-box {
  max-width: 540px;
  margin-top: 6px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: 8px;
  background: var(--panel-2);
  padding: 11px 15px;
}
.embed-author { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.embed-title { color: var(--strong); font-weight: 700; margin-bottom: 4px; }
.embed-desc { margin-bottom: 6px; white-space: pre-wrap; }
.embed-field { margin-top: 4px; }
.embed-footer { color: var(--muted); font-size: 12px; margin-top: 8px; }
.embed-image, .embed-thumb { display: block; max-width: 100%; border-radius: 8px; margin-top: 8px; }
.embed-thumb { max-width: 120px; }
.attachment { margin-top: 6px; }
.attachment img, .attachment-preview { display: block; max-width: min(100%, 460px); max-height: 380px; border-radius: 12px; object-fit: contain; }
.attachment video, .attachment audio { display: block; width: 100%; max-width: 460px; border-radius: 12px; }
.attachment-link { display: inline-block; margin-top: 4px; font-size: 12px; text-decoration: none; }
.attachment-link:hover { text-decoration: underline; }
.sticker-name { color: var(--muted); font-style: italic; }
.missing-media, .redacted-media {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 12px;
}
.missing-media { border: 1px dashed rgba(240, 178, 50, 0.55); background: rgba(240, 178, 50, 0.08); color: #f0b232; }
.redacted-media { border: 1px solid var(--line-2); background: var(--panel-2); color: var(--muted); }
.redacted-link { border-radius: 4px; background: var(--panel-2); color: var(--muted); font-size: 12px; padding: 0 4px; }
.fallback-body { white-space: pre-wrap; padding: 18px 22px; }
.transcript-end { display: flex; align-items: center; gap: 14px; margin: 18px 22px 14px; color: var(--muted); font-size: 12px; font-weight: 700; }
.transcript-end::before, .transcript-end::after { content: ""; flex: 1; border-top: 1px solid var(--line-2); }

/* Side column */
.tx-rail { position: sticky; top: 84px; display: grid; gap: 14px; max-height: calc(100vh - 100px); overflow-y: auto; scrollbar-width: thin; }
.tx-card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); box-shadow: var(--shadow); padding: 16px 18px; }
.tx-card h2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--strong);
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.meta-box { font-size: 14px; line-height: 1.85; }
.meta-box b { color: var(--muted); font-weight: 600; }
.tx-hint { margin: -4px 0 8px; color: var(--muted); font-size: 12px; }
.tx-link { border: 0; background: none; color: var(--accent); cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; letter-spacing: 0; text-transform: none; padding: 0; }
.participant-row { display: flex; align-items: center; gap: 10px; border-radius: 12px; cursor: pointer; padding: 8px; margin: 0 -8px; }
.participant-row:hover { background: var(--hover); }
.participant-row:has(.filter-cb:checked) { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.participant-row:target { animation: kk-flash 1.6s ease-out; }
@keyframes kk-flash { from { background: color-mix(in srgb, var(--accent) 30%, transparent); } to { background: transparent; } }
.filter-cb { flex: none; width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
.participant-avatar, .participant-avatar-fallback { flex: none; width: 34px; height: 34px; border-radius: 50%; object-fit: cover; background: var(--panel-2); }
.participant-info { display: grid; flex: 1; gap: 3px; min-width: 0; }
.participant-name-row { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.participant-name-row b { overflow: hidden; color: var(--strong); text-overflow: ellipsis; white-space: nowrap; }
.participant-share { height: 4px; overflow: hidden; border-radius: 999px; background: var(--panel-2); }
.participant-share span { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
.participant-msgs { color: var(--muted); font-size: 11px; font-weight: 600; }
.participant-id { opacity: 0.75; }
.tx-count { border-radius: 999px; background: var(--panel-2); color: var(--muted); font-size: 11px; padding: 1px 8px; }
.tx-media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.tx-media-grid a { display: block; aspect-ratio: 1; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); }
.tx-media-grid img, .tx-media-grid video { width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s ease; }
.tx-media-grid a:hover img, .tx-media-grid a:hover video { transform: scale(1.06); }

@media (max-width: 1000px) {
  .tx-grid { grid-template-columns: minmax(0, 1fr); }
  .tx-rail { position: static; max-height: none; order: -1; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .tx-hero { grid-template-columns: minmax(0, 1fr); }
  .tx-hero-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .tx-bar-in { flex-wrap: wrap; gap: 10px; padding: 10px 14px; }
  .tx-search { order: 3; max-width: none; flex-basis: 100%; }
  .tx-search kbd { display: none; }
  .tx-bar-actions { margin-left: auto; }
  .tx-page { padding: 14px 10px 40px; }
  .tx-hero { padding: 20px 18px; border-radius: 18px; }
  .tx-hero-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tx-timeline li { flex-basis: 50%; margin-bottom: 10px; }
  .msg { gap: 10px; padding: 7px 12px 7px 10px; }
  .avatar, .participant-avatar-fallback.avatar { width: 34px; height: 34px; }
  .day-divider { top: 104px; }
}
@media print {
  .tx-bar, .tx-rail .participants-box .filter-cb, .tx-hint, .tx-media { display: none; }
  body { background: #fff; color: #111; }
  .tx-grid { grid-template-columns: 1fr; }
  .tx-rail { position: static; max-height: none; }
  .tx-hero, .tx-chat, .tx-card { box-shadow: none; }
  .day-divider { position: static; }
}
`;
