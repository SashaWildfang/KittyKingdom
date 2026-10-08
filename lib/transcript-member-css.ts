// The ticket transcript stylesheet. The website draws every transcript (staff and member copies, old and
// new) with it, and the ticket bot writes the same file into each transcript zip
// (TIcketing/ticketing/ticket_controls.py CSS_CONTENT), so downloads look the same. Keep the two in step.
// The accent colour comes from --accent (Admin → Bots → Ticket Bot → Transcripts).
export const TRANSCRIPT_CSS = `/* Kitty Kingdom ticket transcript */
:root {
  --accent: #ff8b3d;
  --bg: #1e1f22;
  --panel: #2b2d31;
  --panel-2: #232428;
  --line: #3a3c42;
  --text: #dbdee1;
  --muted: #949ba4;
  --link: #00a8fc;
  --mention: rgba(88, 101, 242, 0.28);
  --danger: #f23f43;
  --radius: 14px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: radial-gradient(1200px 500px at 10% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%), var(--bg);
  color: var(--text);
  font: 15px/1.45 "gg sans", "Noto Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
  padding: 28px 20px 60px;
}
a { color: var(--link); }
.layout-container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  max-width: 1280px;
  margin: 0 auto;
  align-items: start;
}
.main-content { min-width: 0; }

/* Header */
.tx-header {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, var(--panel)), var(--panel) 55%);
  padding: 22px 24px;
  margin-bottom: 18px;
}
.tx-kicker {
  margin: 0;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.tx-header h1 { margin: 4px 0 10px; color: #fff; font-size: 30px; line-height: 1.1; letter-spacing: -0.02em; }
.tx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.tx-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
}
.tx-chip.is-accent { border-color: color-mix(in srgb, var(--accent) 60%, transparent); color: var(--accent); }
.tx-chip.is-danger { border-color: rgba(242, 63, 67, 0.6); color: #ff8a8c; }
.tx-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.tx-stats > div {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.22);
  padding: 9px 12px;
}
.tx-stats small { display: block; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
.tx-stats b { display: block; margin-top: 2px; color: #fff; font-size: 14px; }
.header-times { display: none; }
.member-note {
  margin: 0 0 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line));
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  font-size: 13px;
  padding: 10px 14px;
}
.escalated-status {
  margin: 0 0 16px;
  border: 1px solid rgba(242, 63, 67, 0.45);
  border-radius: 10px;
  background: rgba(242, 63, 67, 0.1);
  color: #ffb4b5;
  font-size: 13px;
  padding: 10px 14px;
}

/* Messages */
.tx-messages {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  padding: 8px 0;
}
.day-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 16px 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
.day-divider::before, .day-divider::after { content: ""; flex: 1; border-top: 1px solid var(--line); }
.msg {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 6px 18px 6px 16px;
  margin-top: 10px;
}
.msg:hover { background: rgba(0, 0, 0, 0.12); }
.msg.is-continued { margin-top: 0; padding-top: 2px; padding-bottom: 2px; }
.msg.is-continued .avatar,
.msg.is-continued .participant-avatar-fallback.avatar { visibility: hidden; height: 0; }
.msg.is-continued .author { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.avatar, .participant-avatar-fallback.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: #4e5058;
}
.msg-content { flex: 1; min-width: 0; }
.author {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
}
.timestamp { color: var(--muted); font-size: 12px; font-weight: 500; }
.content { margin-top: 2px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; }
.content:empty { display: none; }
.content code, .embed-box code {
  border-radius: 4px;
  background: var(--panel-2);
  font: 0.88em ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 1px 5px;
}
.content pre {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  overflow-x: auto;
  padding: 10px 12px;
}
.content blockquote { border-left: 4px solid #4e5058; margin: 4px 0; padding-left: 10px; }
.chat-emoji { width: 1.375em; height: 1.375em; vertical-align: bottom; object-fit: contain; }
.mention, a.mention {
  border-radius: 4px;
  background: var(--mention);
  color: #c9cdfb;
  font-weight: 600;
  padding: 0 3px;
  text-decoration: none;
}
.mention:hover { background: #5865f2; color: #fff; }

/* Badges */
.staff-badge, .staff-team-badge, .claimer-badge {
  border-radius: 5px;
  color: #111;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  padding: 2px 6px;
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
  margin: 0 0 2px;
  overflow: hidden;
  color: var(--muted);
  font-size: 13px;
  padding-left: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reply-line::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 8px;
  width: 14px;
  height: 8px;
  border-left: 2px solid #4e5058;
  border-top: 2px solid #4e5058;
  border-top-left-radius: 6px;
}
.reply-line b { color: var(--text); }
.forwarded { margin-top: 6px; border-left: 3px solid #4e5058; padding-left: 10px; }
.forwarded-label { color: var(--muted); font-size: 12px; font-style: italic; }
.reactions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.reaction {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  font-size: 13px;
  padding: 2px 8px;
}
.reaction .chat-emoji { width: 18px; height: 18px; }
.reaction-users { display: block; width: 100%; color: var(--muted); font-size: 11px; margin-top: 2px; }
.button-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.discord-button { border-radius: 6px; color: #fff; font-size: 14px; font-weight: 600; padding: 6px 14px; }
.btn-primary { background: #5865f2; }
.btn-secondary { background: #4e5058; }
.btn-success { background: #248046; }
.btn-danger { background: #da373c; }

/* Embeds and media */
.embed-box {
  max-width: 520px;
  margin-top: 6px;
  border-left: 4px solid var(--accent);
  border-radius: 6px;
  background: var(--panel-2);
  padding: 10px 14px;
}
.embed-author { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.embed-title { color: #fff; font-weight: 700; margin-bottom: 4px; }
.embed-desc { line-height: 1.45; margin-bottom: 6px; white-space: pre-wrap; }
.embed-field { margin-top: 4px; }
.embed-footer { color: var(--muted); font-size: 12px; margin-top: 8px; }
.embed-image, .embed-thumb { display: block; max-width: 100%; border-radius: 6px; margin-top: 8px; }
.embed-thumb { max-width: 120px; }
.attachment { margin-top: 6px; }
.attachment img, .attachment-preview { display: block; max-width: min(100%, 440px); max-height: 360px; border-radius: 8px; object-fit: contain; }
.attachment video, .attachment audio { display: block; width: 100%; max-width: 440px; border-radius: 8px; }
.attachment-link { display: inline-block; margin-top: 4px; font-size: 12px; text-decoration: none; }
.attachment-link:hover { text-decoration: underline; }
.sticker-name { color: var(--muted); font-style: italic; }
.missing-media, .redacted-media, .redacted-link {
  display: inline-block;
  margin-top: 6px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 11px;
}
.missing-media { border: 1px dashed rgba(240, 178, 50, 0.55); background: rgba(240, 178, 50, 0.08); color: #f0b232; }
.redacted-media { border: 1px solid var(--line); background: var(--panel-2); color: var(--muted); }
.redacted-link { margin: 0; padding: 0 4px; background: var(--panel-2); color: var(--muted); }
.fallback-body { white-space: pre-wrap; padding: 16px; }
.transcript-end {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 22px 0 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}
.transcript-end::before, .transcript-end::after { content: ""; flex: 1; border-top: 1px solid var(--line); }

/* Sidebar */
.sidebar { position: sticky; top: 20px; display: grid; gap: 14px; }
.meta-box, .participants-box {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  padding: 16px;
}
.meta-box { font-size: 13px; line-height: 1.7; }
.meta-box b { color: var(--muted); font-weight: 700; }
.search-container { display: grid; gap: 6px; margin-top: 12px; border-top: 1px solid var(--line); padding-top: 12px; }
.search-container input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  outline: none;
  padding: 8px 11px;
}
.search-container input:focus { border-color: var(--accent); }
#searchCount { color: var(--muted); font-size: 12px; }
mark { border-radius: 3px; background: rgba(254, 231, 92, 0.45); color: inherit; padding: 0 2px; }
.participants-box > b {
  display: block;
  margin-bottom: 10px;
  color: var(--accent);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.participant-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 10px;
  padding: 7px 8px;
}
.participant-row:hover { background: rgba(0, 0, 0, 0.18); }
.participant-row:target { animation: kk-flash 1.6s ease-out; }
@keyframes kk-flash { from { background: rgba(254, 231, 92, 0.35); } to { background: transparent; } }
.filter-cb { flex: none; accent-color: var(--accent); cursor: pointer; }
.participant-avatar, .participant-avatar-fallback { flex: none; width: 30px; height: 30px; border-radius: 50%; object-fit: cover; background: #4e5058; }
.participant-info { display: grid; gap: 1px; min-width: 0; }
.participant-name-row { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.participant-name-row b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff; }
.participant-id { color: var(--muted); font-size: 11px; }
.participant-msgs { color: var(--accent); font-size: 11px; font-weight: 700; }
.tx-jump { display: flex; gap: 8px; }
.tx-jump a {
  flex: 1;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  padding: 6px;
  text-align: center;
  text-decoration: none;
}
.tx-jump a:hover { border-color: var(--accent); }

@media (max-width: 920px) {
  body { padding: 16px 10px 40px; }
  .layout-container { grid-template-columns: minmax(0, 1fr); }
  .sidebar { position: static; order: -1; }
  .msg { padding: 6px 10px; gap: 10px; }
  .avatar, .participant-avatar-fallback.avatar { width: 34px; height: 34px; }
  .tx-header h1 { font-size: 24px; }
}
@media print {
  body { background: #fff; color: #111; padding: 0; }
  .sidebar .search-container, .tx-jump, .filter-cb { display: none; }
  .layout-container { grid-template-columns: 1fr; }
  .tx-header, .tx-messages, .meta-box, .participants-box { background: #fff; border-color: #ccc; }
  .author, .tx-header h1, .participant-name-row b, .embed-title, .tx-stats b { color: #111; }
  .msg:hover { background: none; }
}
`;
