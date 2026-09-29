// The ticket bot's transcript stylesheet (TIcketing/ticketing/ticket_controls.py CSS_CONTENT), so member
// copies of old and new transcripts all look like the current format. Keep in step with the bot.
export const TRANSCRIPT_CSS = `/* Discord Ticket Transcript CSS */

body {
    background-color: #313338;
    color: #dbdee1;
    font-family: "Segoe UI", Tahoma, sans-serif;
    padding: 25px;
    margin: 0;
}

.layout-container {
    display: flex;
    max-width: 1300px;
    margin: 0 auto;
    gap: 25px;
    align-items: flex-start;
}

.main-content {
    flex: 1;
    min-width: 0;
}

.sidebar {
    width: 340px;
    flex-shrink: 0;
    position: sticky;
    top: 25px;
}

h1 {
    color: #ff8b3d;
    font-size: 28px;
    margin-top: 0;
    margin-bottom: 4px;
}

.header-times {
    font-size: 13px;
    color: #949ba4;
    margin-bottom: 24px;
    font-weight: 500;
}

.escalated-status {
    color: #ed4245;
    font-size: 14px;
    margin-bottom: 20px;
    background: #2b2d31;
    padding: 10px 14px;
    border-radius: 4px;
    border-left: 4px solid #ed4245;
}

.meta-box, .participants-box {
    background: #2b2d31;
    padding: 16px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

/* Search Bar */
.search-container {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #3f4147;
}

.search-container input {
    flex: 1;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #1e1f22;
    background-color: #1e1f22;
    color: #dbdee1;
    outline: none;
    font-family: inherit;
}

.search-container input:focus {
    border-color: #5865F2;
}

#searchCount {
    font-size: 12px;
    color: #949ba4;
    white-space: nowrap;
}

mark {
    background-color: rgba(254, 231, 92, 0.4);
    color: inherit;
    border-radius: 2px;
    padding: 0 2px;
}

.participants-box > b {
    display: block;
    color: #ff8b3d;
    text-transform: uppercase;
    font-size: 12px;
    margin-bottom: 16px;
    letter-spacing: 0.5px;
}

.participant-row {
    margin-bottom: 12px;
    padding: 8px;
    border-radius: 4px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    transition: background-color 0.3s ease;
}

.participant-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0; /* Ensures child elements can truncate */
}

.participant-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap; /* Forces badges to stay on the same line */
}

.participant-name-row b {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.filter-cb {
    margin-top: 4px;
    cursor: pointer;
}

.participant-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    margin-top: 2px;
}

.participant-avatar-fallback {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: #4e5058;
    margin-top: 2px;
}

.participant-id {
    color: #949ba4;
    font-size: 11px;
}

.participant-msgs {
    font-size: 11px;
    color: #ff8b3d;
    font-weight: bold;
}

/* Flash animation for @mention anchor clicks */
@keyframes flash-highlight {
    0% { background-color: rgba(254, 231, 92, 0.4); box-shadow: 0 0 10px rgba(254, 231, 92, 0.4); }
    100% { background-color: transparent; box-shadow: none; }
}

.participant-row:target {
    animation: flash-highlight 1.5s ease-out;
}

.msg {
    display: flex;
    gap: 14px;
    background: #2b2d31;
    padding: 14px;
    border-radius: 4px;
    margin-bottom: 14px;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
}

.msg-content { flex: 1; }

.author {
    font-size: 16px;
    font-weight: bold;
    color: #ff8b3d;
    display: inline-flex;
    align-items: center;
}

.staff-badge, .staff-team-badge, .claimer-badge {
    color: black;
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: 8px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
}

/* Base colors / Dynamic Role Overrides */
.staff-badge, .staff-team-badge { background-color: #ff8b3d; }
.badge-owner { background-color: #a678f2 !important; color: white !important; }
.badge-admin { background-color: #ff7b7b !important; color: white !important; }
.badge-mod { background-color: #57f287 !important; color: black !important; }
.badge-helper { background-color: #fee75c !important; color: black !important; }
.badge-default { background-color: #ff8b3d !important; color: black !important; }

.claimer-badge {
    background-color: #5865F2;
    color: white;
    white-space: nowrap;
}

.mention {
    color: #c9cdcf;
    background-color: rgba(88, 101, 242, 0.3);
    padding: 0 4px;
    border-radius: 3px;
    text-decoration: none;
    font-weight: 500;
    transition: background-color 0.1s;
}

.mention:hover {
    background-color: #5865F2;
    color: white;
}

.chat-emoji {
    width: 1.375em;
    height: 1.375em;
    vertical-align: bottom;
}

.username {
    font-size: 12px;
    color: #949ba4;
}

.timestamp {
    font-size: 12px;
    color: #949ba4;
    margin-left: 8px;
}

.content {
    margin-top: 6px;
    white-space: pre-wrap;
    line-height: 1.4;
}

.embed-box {
    background: #2f3136;
    padding: 10px 12px;
    border-radius: 4px; 
    border-left: 4px solid #ff8b3d;
    margin-top: 10px;
}

.embed-title { font-weight: bold; color: #ff8b3d; margin-bottom: 4px; }
.embed-desc { margin-bottom: 8px; line-height: 1.4; }
.embed-field { margin-top: 5px; }

.embed-image, .embed-thumb {
    margin-top: 8px;
    max-width: 300px;
    border-radius: 4px;
}

/* Discord-styled buttons */
.button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.discord-button {
    padding: 6px 16px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: default;
    border: none;
    color: white;
}

.btn-primary { background-color: #5865F2; }
.btn-secondary { background-color: #4e5058; }
.btn-success { background-color: #248046; }
.btn-danger { background-color: #da373c; }

.attachment { margin-top: 10px; }

.attachment-preview {
    max-width: 450px;
    border-radius: 4px;
}

.attachment-link {
    font-size: 12px;
    color: #00a8fc;
    text-decoration: none;
    display: inline-block;
    margin-top: 4px;
}

.attachment-link:hover {
    text-decoration: underline;
}

.redacted-media {
    background-color: #111214;
    color: #fff;
    padding: 8px 12px;
    margin-top: 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    border-left: 4px solid #ed4245;
    display: inline-block;
}

/* Centered red line end tag */
.transcript-end {
    display: flex;
    align-items: center;
    text-align: center;
    color: #ed4245;
    font-weight: bold;
    font-size: 16px;
    margin-top: 40px;
    padding-bottom: 30px;
}

.transcript-end::before,
.transcript-end::after {
    content: '';
    flex: 1;
    border-bottom: 2px solid #ed4245;
}

.transcript-end:not(:empty)::before {
    margin-right: 15px;
}

.transcript-end:not(:empty)::after {
    margin-left: 15px;
}

@media (max-width: 900px) {
    .layout-container {
        flex-direction: column;
    }
    .sidebar {
        width: 100%;
        position: static;
        order: -1;
    }
}

/* Replies, reactions and media players */
.reply-line {
    font-size: 12px;
    color: #b5bac1;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.reply-line b { color: #dbdee1; }
.forwarded {
    border-left: 3px solid #4e5058;
    padding-left: 10px;
    margin-top: 6px;
    color: #dbdee1;
}
.forwarded-label { font-size: 12px; color: #949ba4; font-style: italic; margin-bottom: 2px; }
.reactions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.reaction {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 8px;
    background: #2b2d31;
    border: 1px solid #3f4147;
    font-size: 14px;
    cursor: default;
}
.reaction .chat-emoji { width: 18px; height: 18px; margin: 0; }
.reaction b { font-size: 13px; color: #dbdee1; }
.reaction-users {
    display: block;
    font-size: 11px;
    color: #949ba4;
    margin-top: 2px;
    width: 100%;
}
.attachment video, .attachment audio, .embed-box video {
    display: block;
    max-width: 420px;
    width: 100%;
    border-radius: 8px;
    margin-bottom: 4px;
}
.attachment audio { max-width: 360px; }
.missing-media {
    color: #f0b232;
    background: rgba(240, 178, 50, 0.08);
    border: 1px dashed rgba(240, 178, 50, 0.5);
    padding: 8px 10px;
    border-radius: 6px;
    margin-top: 8px;
    font-size: 13px;
}
.missing-media a { color: #00a8fc; }
.embed-author { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.embed-footer { font-size: 12px; color: #949ba4; margin-top: 8px; }
.sticker-name { color: #b5bac1; font-style: italic; }

/* ---------- Member copy (kittykingdom.net): media removed for privacy ---------- */
.redacted-media {
    display: flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    margin: 6px 0;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.04);
    color: #b5bac1;
    font-size: 13px;
    font-style: italic;
}
.member-note {
    margin: 0 0 18px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(88, 101, 242, 0.12);
    border: 1px solid rgba(88, 101, 242, 0.35);
    color: #dbdee1;
    font-size: 14px;
}
.participant-avatar-fallback {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #5865f2;
    flex: none;
}
`;
