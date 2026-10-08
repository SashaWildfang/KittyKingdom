// The Staff Handbook (admin panel → Staff Guide). Safe for the browser: ranks and duties, staff rules, step by
// step procedures (ID verification first), and every staff command with its lowest rank and examples. The
// ranks on each command come from the permission checks in the bots.

export const RANKS = [
  { id: "1358470318087340342", name: "Helper" },
  { id: "1358472557862457537", name: "Jr Mod" },
  { id: "1358472532222808126", name: "Mod" },
  { id: "1358472588430676018", name: "Sr Mod" },
  { id: "1358472511133585564", name: "Admin" },
  { id: "1358472635234779207", name: "Sr Admin" },
  { id: "1358473248534167663", name: "Owner" },
] as const;
export type RankName = (typeof RANKS)[number]["name"];
export const SR_ADMIN_EXTRA = "1416866395366359193"; // a second Sr Admin role
export const STAFF_TEAM = "1358470109965979859";
export const rankIndex = (r: RankName) => RANKS.findIndex((x) => x.name === r);

// ---------------------------------------------------------------- roles & duties

export type RoleInfo = { rank: RankName; summary: string; duties: string[] };

/** What each rank is for. Every rank also does everything the ranks below it do. */
export const ROLES: RoleInfo[] = [
  {
    rank: "Helper",
    summary: "The friendly first contact. Helpers keep chat welcoming, answer questions and keep the queues moving.",
    duties: [
      "Welcome new members and answer questions about the server, roles, levels and the website",
      "Review join applications (accept, deny with a reason, or flag to a Mod+)",
      "Claim and work support tickets",
      "Handle small problems with a friendly word, /warn or /tempmute",
      "Spot raids early and turn on AutoMod raid mode",
      "Pass anything bigger (bans, ID problems, staff issues) to a higher rank in #staff-general",
    ],
  },
  {
    rank: "Jr Mod",
    summary: "Junior moderators take on channel control and 18+ verification.",
    duties: [
      "Run ID checks in NSFW verification tickets and grant access with /nsfwverify",
      "Keep channels calm: /slowmode, /lockchannel, /clear and /clearall",
      "Kick members who need removing but not banning",
      "Request bans with /ban: a Mod+ reviews every Jr Mod ban before it happens",
      "Send members back to verification with /forceunverify when needed",
    ],
  },
  {
    rank: "Mod",
    summary: "Moderators handle serious cases: bans, long mutes and age problems.",
    duties: [
      "Ban raiders, scammers, anyone underage and anyone falsifying their age",
      "Review Jr Mod ban requests (the buttons in the staff alerts channel, or the website's Ban Requests tab): approve with CONFIRM, or deny with a reason",
      "Mute and unmute members for longer problems",
      "Take over ID verification discrepancies from Helpers and Jr Mods",
      "Help and guide Helpers and Jr Mods",
    ],
  },
  {
    rank: "Sr Mod",
    summary: "Senior moderators lead the moderation team day to day.",
    duties: [
      "Unban members when an Admin approves an appeal or a ban was a mistake",
      "Give a second opinion on hard calls and step in on heated situations",
      "Keep an eye on how the moderation team is doing and raise concerns with Admins",
    ],
  },
  {
    rank: "Admin",
    summary: "Admins run the server's systems and the staff team.",
    duties: [
      "Decide punishment appeals on the website's Appeals tab",
      "Manage AutoMod rules and word lists, lockdowns and server setup",
      "Handle economy, levels, store and inventory corrections",
      "Approve news posts, watch tickets, accounts and traffic on the website",
      "Handle reports about staff members and support the Owner",
    ],
  },
  {
    rank: "Sr Admin",
    summary: "Senior admins share the Owner's oversight of the team.",
    duties: ["Everything an Admin does", "Help decide promotions, demotions and staff discipline with the Owner"],
  },
  {
    rank: "Owner",
    summary: "The Owner has the final say on everything in Kitty Kingdom.",
    duties: ["The only rank that can mute, ban or discipline staff members", "Final decisions on rules, staff and server direction"],
  },
];

// ---------------------------------------------------------------- staff rules

export type RuleGroup = { title: string; icon: string; rules: string[] };

export const STAFF_RULES: RuleGroup[] = [
  {
    title: "Conduct",
    icon: "heart",
    rules: [
      "Be kind, patient and professional. You represent Kitty Kingdom in every message.",
      "Follow the server rules yourself. Staff are held to a higher standard than members.",
      "Never use your role or bot commands for jokes, favours or personal arguments.",
      "Don't moderate a situation you're personally involved in. Hand it to another staff member.",
      "Disagree with other staff privately in the staff channels, never in front of members.",
    ],
  },
  {
    title: "Moderating",
    icon: "gavel",
    rules: [
      "Use the lightest action that fixes the problem, and always give a clear reason.",
      "Every punishment goes through the bots so it's logged. No manual role changes or Discord timeouts.",
      "Check /punishments before you act, so you know someone's history.",
      "Read the summary before you type CONFIRM on a ban. It's permanent and the member is told the reason.",
      "Never punish another staff member. Report it to an Admin; only the Owner can punish staff.",
      "Don't reverse another staff member's action without talking to them or an Admin first.",
      "If you're not sure, ask in #staff-general before you act.",
    ],
  },
  {
    title: "Privacy",
    icon: "lock",
    rules: [
      "What's said in staff channels stays there. No screenshots or sharing outside the team.",
      "ID photos and personal details from verification are never saved, shared or discussed outside the ticket.",
      "Never share the rules password, member applications or anyone's personal information.",
    ],
  },
  {
    title: "Activity",
    icon: "clock",
    rules: [
      "Stay active in chat and in the queues (applications and tickets) for your rank.",
      "Claim a ticket before working on it, and close it when it's done.",
      "Tell an Admin if you'll be away for a while.",
      "Your activity (punishments, tickets and applications) is tracked. Long inactivity without notice can lead to a demotion.",
    ],
  },
];

// ---------------------------------------------------------------- procedures

export type Step = { title: string; detail: string; example?: string; min?: RankName };
export type Outcome = { when: string; tone: "good" | "bad" | "warn"; do: string; example?: string; min?: RankName; otherwise?: string };
export type Procedure = { key: string; title: string; icon: string; min: RankName; summary: string; steps: Step[]; outcomes?: Outcome[]; notes?: string[] };

export const ID_VERIFICATION: Procedure = {
  key: "id",
  title: "ID verification (18+ access)",
  icon: "id",
  min: "Helper",
  summary: "Members open an NSFW verification ticket to get the 18+ role. We cross-check the date of birth on their ID against the one they gave on their join application.",
  steps: [
    { title: "Claim the ticket", detail: "Open the member's NSFW verification ticket and claim it so nobody else picks it up.", example: "/ticket claim" },
    {
      title: "Ask for their ID",
      detail: "Ask for a photo of a government ID that shows their date of birth. They can cover everything except the date of birth.",
    },
    {
      title: "Pull up their join application",
      detail: "Run /getjoinapp on the member. It's private to you by default. Find the “Age & date of birth” line they gave when they joined.",
      example: "/getjoinapp target_user:@member",
    },
    { title: "Compare the two dates of birth", detail: "The date of birth on the ID must match the one on the application exactly, and show they're 18 or older." },
  ],
  outcomes: [
    {
      when: "The dates match and they're 18+",
      tone: "good",
      do: "Give them the 18+ role in the ticket, then close the ticket.",
      example: "/nsfwverify user:@member",
      min: "Jr Mod",
      otherwise: "Helpers can't run /nsfwverify: ping a Jr Mod or higher in #staff-general to finish it.",
    },
    {
      when: "The dates don't match, or the ID shows they're under 18",
      tone: "bad",
      do: "Do not verify them. Ban them for falsifying their age.",
      example: "/ban user:@member reason:Falsifying age appealable:No",
      min: "Mod",
      otherwise: "Jr Mods: /ban sends a ban request that a Mod+ approves. Helpers: ping a higher staff member in #staff-general with a link to the ticket, and leave the ticket open for them.",
    },
    {
      when: "The ID is unreadable, cropped wrong or looks edited",
      tone: "warn",
      do: "Ask for a clearer photo. If you're still unsure, ask a higher rank in #staff-general before deciding.",
    },
  ],
  notes: [
    "Never save, download or share an ID photo. Close the ticket as soon as you're done.",
    "Don't tell the member what their application said. Ask them to confirm their date of birth instead.",
  ],
};

export const PROCEDURES: Procedure[] = [
  {
    key: "apps",
    title: "Join applications",
    icon: "clipboard",
    min: "Helper",
    summary: "New members fill in a form when they join. Review it in the Discord applications channel or on the website's Join Apps tab. Members are told we answer within 24 hours.",
    steps: [
      { title: "Open the pending list", detail: "Use the website's Join Apps tab, or list them in Discord.", example: "/pending" },
      { title: "Check the age", detail: "Date of birth must be filled in properly and show they're 18 or older. Underage forms are kicked automatically." },
      { title: "Check the password", detail: "It must match the password hidden in the rules. The bot already handles wrong ones: a near miss is auto-denied with a 5-minute wait, and a guess that's nowhere close is banned automatically (appealable).", example: "/getpassword" },
      { title: "Check the answers", detail: "Look for real effort in how they found us, their fursona and the bit about themselves." },
    ],
    outcomes: [
      { when: "Everything checks out", tone: "good", do: "Accept. They get the member role and a welcome in general chat." },
      { when: "Something's missing or wrong", tone: "warn", do: "Deny with a clear reason so they can fix it and apply again." },
      { when: "Raider, troll or obvious fake", tone: "bad", do: "Use Ban on the application. It's logged like any other ban." },
    ],
    notes: [
      "Denied someone who should get another try straight away? /resetverification user:@member lifts the waiting period.",
      "Anyone who joins and leaves within 2 minutes is banned automatically as a likely raid or spam account. The ban is appealable, so a real person can appeal and be unbanned.",
    ],
  },
  {
    key: "problem",
    title: "Handling a problem in chat",
    icon: "alert",
    min: "Helper",
    summary: "Pick the lightest step that fixes it, and move up only if it keeps happening.",
    steps: [
      { title: "Check their record", detail: "See if this is a first time or a pattern.", example: "/punishments user:@member" },
      { title: "Talk first", detail: "A friendly reminder in chat fixes most things." },
      { title: "Warn", detail: "Logged on their record, with your reason.", example: "/warn user:@member reason:Spamming after being asked to stop" },
      { title: "Tempmute", detail: "Time out to cool off. The member is told how long.", example: "/tempmute user:@member duration:1h reason:Arguing after a warning" },
      { title: "Ban", detail: "For serious or repeated problems. Jr Mods' bans go to a Mod+ to approve.", example: "/ban user:@member reason:Repeated harassment after warnings and mutes", min: "Jr Mod" },
    ],
    notes: ["AutoMod already handles spam, slurs, scam links and invites with growing mutes. You don't need to punish what it caught."],
  },
  {
    key: "banreq",
    title: "Reviewing a Jr Mod's ban request",
    icon: "gavel",
    min: "Mod",
    summary: "Jr Mods can't ban on their own. Their /ban becomes a request in the staff alerts channel and on the website's Ban Requests tab.",
    steps: [
      { title: "Open the request", detail: "Use the card in the staff alerts channel, or the Ban Requests tab here. You can't review your own request." },
      { title: "Check it", detail: "Look at their record and what happened. Is the reason right, and should it be appealable?", example: "/punishments user:@member" },
    ],
    outcomes: [
      { when: "It's the right call", tone: "good", do: "Approve. You'll see a summary and type CONFIRM; the bot bans them and tells the Jr Mod.", min: "Mod" },
      { when: "It's not a ban", tone: "warn", do: "Deny it with a reason. The Jr Mod is told why, so they can learn from it (maybe a tempmute fits better).", min: "Mod" },
      { when: "They're already banned", tone: "bad", do: "Nothing to do: approving just closes the request." },
    ],
  },
  {
    key: "tickets",
    title: "Working a ticket",
    icon: "ticket",
    min: "Helper",
    summary: "Members open tickets from the support and verification panels.",
    steps: [
      { title: "Claim it", detail: "So two people don't answer the same ticket.", example: "/ticket claim" },
      { title: "Bring in anyone you need", detail: "Add another staff member or the person it's about.", example: "/ticket adduser user:@someone" },
      { title: "Keep it in the ticket", detail: "The member gets a transcript when it's closed and can read it on the website." },
      { title: "Close it", detail: "As soon as it's done.", example: "/ticket close" },
    ],
  },
  {
    key: "raid",
    title: "A raid",
    icon: "siren",
    min: "Helper",
    summary: "Lots of new accounts spamming at once.",
    steps: [
      { title: "Turn on raid mode", detail: "Tightens AutoMod for a while. It never kicks or bans on its own.", example: "/automod raidmode enabled:True minutes:60" },
      { title: "Clean up", detail: "Delete the spam and mute the accounts doing it.", example: "/clear amount:50", min: "Jr Mod" },
      { title: "Get an Admin", detail: "Ping an Admin in #staff-general. Admins can lock the server down.", example: "/lockdown reason:Raid in progress", min: "Admin" },
    ],
    notes: ["Don't argue with raiders. Delete, mute and move on."],
  },
  {
    key: "channel",
    title: "A channel getting out of hand",
    icon: "hash",
    min: "Jr Mod",
    summary: "An argument or pile-on that won't calm down.",
    steps: [
      { title: "Slow it down", detail: "Slowmode is usually enough.", example: "/slowmode seconds:30" },
      { title: "Lock it for a bit", detail: "Set a time so it reopens by itself.", example: "/lockchannel duration:30m" },
      { title: "Tidy up", detail: "A transcript of everything removed is kept for the record.", example: "/clearall user:@member" },
      { title: "Back to normal", detail: "When things have calmed down.", example: "/clearslowmode" },
    ],
  },
  {
    key: "appeal",
    title: "Appeals and unbans",
    icon: "scale",
    min: "Sr Mod",
    summary: "Members appeal on the website. Admins decide; Sr Mods and up can carry out unbans.",
    steps: [
      { title: "Decide the appeal", detail: "On the website's Appeals tab. The member is told the result (by email if they left one).", min: "Admin" },
      { title: "Unban if approved", detail: "Now, or on a schedule.", example: "/unban user_id:123456789012345678 reason:Appeal approved" },
    ],
  },
];

// ---------------------------------------------------------------- commands

export type GuideCommand = { cmd: string; what: string; min: RankName; examples: string[]; notes?: string };
export type CommandGroup = { key: string; title: string; icon: string; about: string; commands: GuideCommand[] };

export const COMMAND_GROUPS: CommandGroup[] = [
  {
    key: "warn",
    title: "Warnings & mutes",
    icon: "volume",
    about: "Logged on the member's record, which they can see on the website.",
    commands: [
      { cmd: "/warn user reason", what: "A logged warning.", min: "Helper", examples: ["/warn user:@member reason:Keep it SFW in general please"] },
      {
        cmd: "/tempmute user duration reason [silent]",
        what: "Mute with a timer. Durations: s, m, h, d (combine them, like 1h30m). They're told how long, and it lifts on its own.",
        min: "Helper",
        examples: ["/tempmute user:@member duration:30m reason:Spamming", "/tempmute user:@member duration:1d reason:Harassment silent:True"],
        notes: "silent:True keeps the confirmation private to you.",
      },
      { cmd: "/muteduration [user]", what: "How long a mute has left.", min: "Helper", examples: ["/muteduration user:@member"] },
      { cmd: "/mute user reason [silent]", what: "Mute until someone unmutes them.", min: "Mod", examples: ["/mute user:@member reason:Waiting on an Admin decision"] },
      { cmd: "/unmute user [reason] [silent]", what: "Lift any mute.", min: "Mod", examples: ["/unmute user:@member reason:Talked it through"] },
      {
        cmd: "/muzzle user [duration] [reason]",
        what: "A short mute (seconds to hours, default 1 minute). Run it again on someone who's muzzled to unmuzzle them.",
        min: "Admin",
        examples: ["/muzzle user:@member duration:5m reason:Cool down", "/muzzle user:@member"],
      },
    ],
  },
  {
    key: "remove",
    title: "Kicks & bans",
    icon: "gavel",
    about: "Only the Owner can kick, mute or ban another staff member.",
    commands: [
      { cmd: "/kick user reason [silent]", what: "Remove someone from the server. They can rejoin.", min: "Jr Mod", examples: ["/kick user:@member reason:Alt account"] },
      {
        cmd: "/ban user reason [appealable] [silent]",
        what: "Mod+: a permanent ban, after you check the summary and type CONFIRM. The member gets a DM with the reason, case ID and how to appeal (appealable defaults to Yes). Jr Mods: the same command sends a ban request that a Mod+ approves or denies. It won't run if they're already banned or already have a request waiting.",
        min: "Jr Mod",
        examples: ["/ban user:@member reason:Falsifying age appealable:No", "/ban user:@member reason:Repeated harassment after warnings"],
        notes: "Use the user's ID if they've already left: paste it into the user field.",
      },
      {
        cmd: "/unban user_id reason [duration] [silent]",
        what: "Unban now, or schedule the unban for later with a duration.",
        min: "Sr Mod",
        examples: ["/unban user_id:123456789012345678 reason:Appeal approved", "/unban user_id:123456789012345678 reason:Temp ban served duration:7d"],
      },
    ],
  },
  {
    key: "records",
    title: "Records & lookups",
    icon: "search",
    about: "Find out who someone is and what's happened before.",
    commands: [
      { cmd: "/punishments user [silent]", what: "Someone's full record (warnings, mutes, kicks and bans).", min: "Helper", examples: ["/punishments user:@member silent:True"] },
      { cmd: "/clearpunishment user", what: "Remove one punishment from someone's record. You pick which from a list.", min: "Helper", examples: ["/clearpunishment user:@member"] },
      { cmd: "/whois discord_input", what: "Account age, join date, roles and more. Works with a mention or an ID.", min: "Helper", examples: ["/whois discord_input:@member", "/whois discord_input:123456789012345678"] },
      { cmd: "/stats [user]", what: "Level, leaves, activity and boosters.", min: "Helper", examples: ["/stats user:@member"] },
    ],
  },
  {
    key: "channels",
    title: "Channels",
    icon: "hash",
    about: "Run these in the channel you want to change.",
    commands: [
      { cmd: "/slowmode seconds", what: "Turn on slowmode.", min: "Jr Mod", examples: ["/slowmode seconds:15"] },
      { cmd: "/clearslowmode", what: "Turn slowmode off.", min: "Jr Mod", examples: ["/clearslowmode"] },
      { cmd: "/lockchannel [duration]", what: "Lock the channel for members (staff keep access). With a duration it unlocks by itself.", min: "Jr Mod", examples: ["/lockchannel duration:30m", "/lockchannel"] },
      { cmd: "/unlockchannel", what: "Unlock it again.", min: "Jr Mod", examples: ["/unlockchannel"] },
      { cmd: "/showlockedchannels", what: "Every channel that's locked right now.", min: "Jr Mod", examples: ["/showlockedchannels"] },
      { cmd: "/clear amount [user]", what: "Delete up to 100 recent messages (optionally only one person's). A transcript is saved.", min: "Jr Mod", examples: ["/clear amount:25", "/clear amount:50 user:@member"] },
      { cmd: "/clearall user", what: "Delete everything one person said in this channel, with a transcript.", min: "Jr Mod", examples: ["/clearall user:@member"] },
    ],
  },
  {
    key: "lockdown",
    title: "Lockdown",
    icon: "siren",
    about: "For raids. Try AutoMod's raid mode first.",
    commands: [
      { cmd: "/lockdown [reason]", what: "Turn server lockdown on or off: invites are paused and new joins are kicked.", min: "Admin", examples: ["/lockdown reason:Raid in progress"] },
      { cmd: "/updatelockdown message", what: "Post an update to the lockdown announcement.", min: "Admin", examples: ["/updatelockdown message:Raid accounts removed, reopening soon"] },
      { cmd: "/lockdownstatus", what: "Whether lockdown is on, and the latest updates.", min: "Helper", examples: ["/lockdownstatus"] },
    ],
  },
  {
    key: "apps",
    title: "Join applications",
    icon: "clipboard",
    about: "The website's Join Apps tab does all of this too.",
    commands: [
      { cmd: "/pending", what: "Every application waiting for review.", min: "Helper", examples: ["/pending"] },
      {
        cmd: "/getjoinapp [target_user] [silent]",
        what: "A member's full application, including their date of birth. Private to you unless silent:False.",
        min: "Helper",
        examples: ["/getjoinapp target_user:@member", "/getjoinapp target_user:123456789012345678"],
        notes: "This is the command for ID verification.",
      },
      { cmd: "/applicationstatus user", what: "Where someone's application stands.", min: "Helper", examples: ["/applicationstatus user:@member"] },
      { cmd: "/getpassword", what: "The password hidden in the rules.", min: "Helper", examples: ["/getpassword"] },
      { cmd: "/resetverification user", what: "Let a denied member apply again right away.", min: "Helper", examples: ["/resetverification user:@member"] },
      { cmd: "/verificationstats", what: "Numbers for the verification system.", min: "Helper", examples: ["/verificationstats"] },
      { cmd: "/exportapplications", what: "Every application as a spreadsheet.", min: "Helper", examples: ["/exportapplications"] },
      {
        cmd: "/kickunverified [reason] [silent] [dry_run]",
        what: "Kick everyone who only has the Unverified role. Asks you to confirm first.",
        min: "Helper",
        examples: ["/kickunverified dry_run:True", "/kickunverified reason:Unverified cleanup"],
        notes: "Run with dry_run:True first to see who it would kick, and check with an Admin.",
      },
      { cmd: "/forceunverify user_or_id", what: "Send someone back to Unverified, even if they've left.", min: "Jr Mod", examples: ["/forceunverify user_or_id:@member"] },
      { cmd: "/changepassword new_pass", what: "Change the rules password.", min: "Admin", examples: ["/changepassword new_pass:autumnleaves"] },
    ],
  },
  {
    key: "nsfw",
    title: "18+ & artist roles",
    icon: "id",
    about: "Run these inside the member's ticket.",
    commands: [
      { cmd: "/nsfwverify [user]", what: "Give the 18+ role. In an NSFW verification ticket it finds the member by itself.", min: "Jr Mod", examples: ["/nsfwverify", "/nsfwverify user:@member"] },
      { cmd: "/grantrole user role_type", what: "Give the SFW or NSFW Artist role. Only works in a claimed ticket.", min: "Helper", examples: ["/grantrole user:@member role_type:SFW Artist"] },
    ],
  },
  {
    key: "ticket",
    title: "Tickets (/ticket)",
    icon: "ticket",
    about: "Run these inside a ticket channel. The buttons on the ticket do the same.",
    commands: [
      { cmd: "/ticket claim", what: "Take the ticket so others know you've got it.", min: "Helper", examples: ["/ticket claim"] },
      { cmd: "/ticket status", what: "Who opened it, who claimed it and how long it's been open.", min: "Helper", examples: ["/ticket status"] },
      { cmd: "/ticket adduser user", what: "Bring someone into the ticket.", min: "Helper", examples: ["/ticket adduser user:@someone"] },
      { cmd: "/ticket removeuser user", what: "Take someone out of the ticket.", min: "Helper", examples: ["/ticket removeuser user:@someone"] },
      { cmd: "/ticket close", what: "Close it. The member gets a transcript link.", min: "Helper", examples: ["/ticket close"] },
      { cmd: "/ticket reopen", what: "Bring a closed ticket back.", min: "Helper", examples: ["/ticket reopen"] },
      { cmd: "/ticket delete", what: "Delete the ticket channel.", min: "Helper", examples: ["/ticket delete"] },
      {
        cmd: "/ticket create user [ticket_type]",
        what: "Open a ticket for someone. Types: nsfw, support, staff-application or manual.",
        min: "Helper",
        examples: ["/ticket create user:@member ticket_type:support", "/ticket create user:@member ticket_type:nsfw"],
      },
    ],
  },
  {
    key: "ticketadmin",
    title: "Ticket admin (/ticketadmin)",
    icon: "files",
    about: "Looking back through tickets and transcripts.",
    commands: [
      { cmd: "/ticketadmin stats [days]", what: "Ticket numbers for the team over a number of days (30 by default).", min: "Helper", examples: ["/ticketadmin stats", "/ticketadmin stats days:7"] },
      { cmd: "/ticketadmin get_tickets user", what: "Someone's recent ticket history.", min: "Admin", examples: ["/ticketadmin get_tickets user:@member"] },
      { cmd: "/ticketadmin getinfo ticket_id", what: "Everything stored about one ticket.", min: "Admin", examples: ["/ticketadmin getinfo ticket_id:1234"] },
      { cmd: "/ticketadmin grab_transcripts user", what: "Someone's ticket transcripts as files.", min: "Admin", examples: ["/ticketadmin grab_transcripts user:@member"] },
      { cmd: "/ticketadmin sync_transcripts", what: "Rebuild the ticket database from the transcript log channel.", min: "Admin", examples: ["/ticketadmin sync_transcripts"] },
    ],
  },
  {
    key: "automod",
    title: "AutoMod (/automod)",
    icon: "shield",
    about: "AutoMod deletes and punishes on its own. Admins can also change everything on the website's AutoMod tab.",
    commands: [
      { cmd: "/automod status", what: "Which rules are on and what it caught in the last 24 hours.", min: "Helper", examples: ["/automod status"] },
      { cmd: "/automod test text", what: "How a message would be treated. Nobody is punished.", min: "Helper", examples: ["/automod test text:check out discord.gg/abc"] },
      { cmd: "/automod history user", what: "What it caught for someone lately.", min: "Helper", examples: ["/automod history user:@member"] },
      { cmd: "/automod words", what: "The blocked words, behind spoilers.", min: "Helper", examples: ["/automod words"] },
      { cmd: "/automod raidmode enabled [minutes]", what: "Tighter limits during a raid (5 to 720 minutes). Never kicks or bans.", min: "Helper", examples: ["/automod raidmode enabled:True minutes:60", "/automod raidmode enabled:False"] },
      {
        cmd: "/automod addword word [severity] [match]",
        what: "Block a word. severe words are blocked everywhere, even in relaxed channels. match:partial catches it inside other words.",
        min: "Admin",
        examples: ["/automod addword word:badword", "/automod addword word:slur severity:severe match:partial"],
      },
      { cmd: "/automod removeword word", what: "Unblock a word.", min: "Admin", examples: ["/automod removeword word:badword"] },
      { cmd: "/automod allow word [remove]", what: "Always allow a word the filter catches by mistake, like a place name.", min: "Admin", examples: ["/automod allow word:Scunthorpe", "/automod allow word:Scunthorpe remove:True"] },
      { cmd: "/automod rule rule enabled [action]", what: "Turn a rule on or off, or set what it does: punish, delete or alert.", min: "Admin", examples: ["/automod rule rule:media enabled:True action:delete", "/automod rule rule:caps enabled:False"], notes: "Rule names: words, invites, scams, mentions, pings, spam, crosspost, media, caps, formatting, emoji, newcomers, names, edits, splits, mediaHint, mediaChannels, dm." },
      { cmd: "/automod exempt channel [remove]", what: "Let a channel or category skip AutoMod (severe words and scams are still blocked).", min: "Admin", examples: ["/automod exempt channel:#art-share", "/automod exempt channel:#art-share remove:True"] },
    ],
  },
  {
    key: "economy",
    title: "Economy & levels",
    icon: "leaf",
    about: "Fixing balances, XP and levels. Every change is logged.",
    commands: [
      { cmd: "/economy add · remove · set user amount [silent]", what: "Change someone's leaves.", min: "Admin", examples: ["/economy add user:@member amount:500", "/economy set user:@member amount:10000 silent:True"] },
      { cmd: "/economy reset user [silent]", what: "Set someone's leaves to 0.", min: "Admin", examples: ["/economy reset user:@member"] },
      { cmd: "/xpadmin add · remove · set user amount [silent]", what: "Change someone's XP (remove never lowers their level).", min: "Admin", examples: ["/xpadmin add user:@member amount:1000"] },
      { cmd: "/leveladmin action user [amount] [silent]", what: "Add, Remove, Set or Reset someone's level.", min: "Admin", examples: ["/leveladmin action:Set user:@member amount:20"] },
    ],
  },
  {
    key: "store",
    title: "Store & inventory",
    icon: "bag",
    about: "Items, boosters and roles from the store.",
    commands: [
      { cmd: "/inventoryadmin view user", what: "Everything someone owns.", min: "Admin", examples: ["/inventoryadmin view user:@member"] },
      { cmd: "/inventoryadmin history user [page]", what: "Someone's store purchases.", min: "Admin", examples: ["/inventoryadmin history user:@member page:2"] },
      { cmd: "/inventoryadmin add · remove user item [amount]", what: "Give or take a store item for free.", min: "Admin", examples: ["/inventoryadmin add user:@member item:2x XP Booster amount:1"], notes: "Start typing in the item field and pick from the list." },
      { cmd: "/storeadmin action", what: "Force a new daily or weekly rotation.", min: "Admin", examples: ["/storeadmin action:resetdaily"] },
    ],
  },
  {
    key: "setup",
    title: "Server setup",
    icon: "settings",
    about: "Reposting the server's panels and keeping the bots running.",
    commands: [
      { cmd: "/deploy_roles · /deploy_nsfw_roles", what: "Repost the role selector galleries.", min: "Admin", examples: ["/deploy_roles"] },
      { cmd: "/discord create_support_panel · create_staff_panel · create_nsfw_panel", what: "Repost the ticket panels.", min: "Admin", examples: ["/discord create_support_panel"] },
      { cmd: "/qotd_post", what: "Post a Question of the Day now.", min: "Admin", examples: ["/qotd_post"] },
      { cmd: "/restartsystem bot_name [reason]", what: "Restart one of the bots on the host.", min: "Admin", examples: ["/restartsystem bot_name:Moderation System reason:Not responding"] },
      { cmd: "/wipe user_id", what: "Remove a member and their data.", min: "Admin", examples: ["/wipe user_id:123456789012345678"] },
    ],
  },
];

/** The website panel tabs a level can open. */
export const PANEL_TABS = {
  staff: ["Overview", "Staff Guide", "Punishments", "Ban Requests", "AutoMod", "Join Apps", "Logs", "Social", "Games", "Live Chat"],
  admin: ["Appeals", "Messages", "Tickets", "Accounts", "News", "Traffic"],
};
