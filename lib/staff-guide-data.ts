// The Staff Guide's content (safe for the browser): every Discord command the staff team has, the lowest rank that can
// use it (taken from the permission checks in the bots), and how-tos. Each staff member sees their own
// rank, what they can do now and what unlocks as they move up. Admins can add team notes on top.

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

export type GuideCommand = { cmd: string; what: string; min: RankName; tip?: string };
export type GuideCategory = { key: string; title: string; icon: string; about: string; commands: GuideCommand[] };

export const COMMANDS: GuideCategory[] = [
  {
    key: "punish",
    title: "Punishments",
    icon: "gavel",
    about: "Everything here is logged to the member's record (the website Punishments tab and /punishments).",
    commands: [
      { cmd: "/warn <user> <reason>", what: "Give a logged warning.", min: "Helper", tip: "The lightest tool. Use it first for most first offences." },
      { cmd: "/tempmute <user> <duration> <reason>", what: "Mute with a timer (e.g. 30m, 2h, 1d). The member is told how long, and it lifts on its own.", min: "Helper" },
      { cmd: "/punishments <user>", what: "A member's full record.", min: "Helper" },
      { cmd: "/clearpunishment <user>", what: "Remove one punishment from someone's record (pick it from a list).", min: "Helper" },
      { cmd: "/muteduration <user>", what: "How long a mute has left.", min: "Helper" },
      { cmd: "/kick <user> <reason>", what: "Remove someone from the server (they can rejoin).", min: "Jr Mod" },
      { cmd: "/mute <user> <reason>", what: "Mute until someone unmutes them.", min: "Mod" },
      { cmd: "/unmute <user>", what: "Lift any mute.", min: "Mod" },
      { cmd: "/ban <user> <reason> [appealable]", what: "Permanent ban. The member gets a DM with the reason and how to appeal (unless you set it not appealable).", min: "Mod", tip: "Only the Owner can ban, mute or tempmute another staff member." },
      { cmd: "/unban <user>", what: "Unban now, or schedule an unban.", min: "Sr Mod" },
      { cmd: "/muzzle <user> [duration] [reason]", what: "A quick mute for a few seconds or minutes. Run it again on the same person to unmuzzle.", min: "Admin" },
    ],
  },
  {
    key: "channels",
    title: "Members & channels",
    icon: "users",
    about: "Looking people up and keeping channels calm.",
    commands: [
      { cmd: "/whois <user or ID>", what: "Look up a member: account age, join date, roles and more.", min: "Helper" },
      { cmd: "/stats <user>", what: "A member's level, leaves and activity (staff see a little more).", min: "Helper" },
      { cmd: "/clear <amount>", what: "Bulk delete recent messages. A transcript is saved to the logs.", min: "Jr Mod" },
      { cmd: "/clearall <user>", what: "Delete one person's messages in this channel, with a transcript.", min: "Jr Mod" },
      { cmd: "/slowmode <seconds> · /clearslowmode", what: "Turn slowmode on or off in this channel.", min: "Jr Mod" },
      { cmd: "/lockchannel [duration] · /unlockchannel", what: "Lock a channel, optionally for a set time. Staff keep access.", min: "Jr Mod" },
      { cmd: "/showlockedchannels", what: "Every channel that's locked right now.", min: "Jr Mod" },
      { cmd: "/lockdown · /updatelockdown · /lockdownstatus", what: "Server-wide lockdown: pauses invites and auto-kicks new joins, with a public update trail.", min: "Admin", tip: "For raids. Try AutoMod's raid mode first." },
      { cmd: "/wipe <user>", what: "Remove a member and their data from the server.", min: "Admin" },
    ],
  },
  {
    key: "verify",
    title: "Verification & 18+",
    icon: "badge",
    about: "New members fill in a form when they join. Staff review it here, in the Discord applications channel, or in the website's Join Apps tab.",
    commands: [
      { cmd: "/pending", what: "Every application waiting for review.", min: "Helper" },
      { cmd: "/applicationstatus <user> · /getjoinapp <user>", what: "See a member's application and where it stands.", min: "Helper" },
      { cmd: "/getpassword", what: "The current password hidden in the rules (members need it for their form).", min: "Helper" },
      { cmd: "/resetverification <user>", what: "Let someone who was denied apply again straight away.", min: "Helper" },
      { cmd: "/verificationstats · /exportapplications", what: "Numbers for the verification system, or every application as a spreadsheet.", min: "Helper" },
      { cmd: "/kickunverified", what: "Mass kick everyone who only has the Unverified role (asks to confirm first).", min: "Helper", tip: "Big action: check with an admin before running it." },
      { cmd: "/forceunverify <user>", what: "Send a member back to Unverified (works even if they've left).", min: "Jr Mod" },
      { cmd: "/nsfwverify [user]", what: "Give 18+ access. Run it in the member's NSFW verification ticket.", min: "Jr Mod" },
      { cmd: "/grantrole <user> <role>", what: "Give the SFW or NSFW Artist role, from inside a claimed ticket.", min: "Helper" },
      { cmd: "/changepassword", what: "Change the rules password.", min: "Admin" },
    ],
  },
  {
    key: "tickets",
    title: "Tickets",
    icon: "ticket",
    about: "Members open tickets from the support and verification panels. Use the buttons on the ticket, or these commands inside it.",
    commands: [
      { cmd: "/ticket claim", what: "Take the ticket so others know you've got it.", min: "Helper" },
      { cmd: "/ticket close · reopen", what: "Close it (the member gets a transcript link) or bring it back.", min: "Helper" },
      { cmd: "/ticket adduser · removeuser", what: "Bring someone into the ticket, or take them out.", min: "Helper" },
      { cmd: "/ticket create <user>", what: "Open a ticket on someone's behalf.", min: "Helper" },
      { cmd: "/ticket status", what: "Who opened it, who claimed it, how long it's been open.", min: "Helper" },
      { cmd: "/ticketadmin stats", what: "Ticket numbers for the whole team.", min: "Helper" },
      { cmd: "/ticketadmin get_tickets · getinfo · grab_transcripts", what: "A member's ticket history and transcripts.", min: "Admin" },
    ],
  },
  {
    key: "automod",
    title: "AutoMod",
    icon: "shield",
    about: "AutoMod deletes and punishes spam, slurs, scams and invites on its own, with mutes that grow each time. Settings live on the website's AutoMod tab.",
    commands: [
      { cmd: "/automod status", what: "Which rules are on and what it caught in the last 24 hours.", min: "Helper" },
      { cmd: "/automod test <message>", what: "How a message would be treated (nobody is punished).", min: "Helper" },
      { cmd: "/automod history <user>", what: "What it caught for someone lately.", min: "Helper" },
      { cmd: "/automod words", what: "The blocked words, behind spoilers.", min: "Helper" },
      { cmd: "/automod raidmode", what: "Tighter limits during a raid. Never kicks or bans.", min: "Helper" },
      { cmd: "/automod addword · removeword · allow", what: "Change the word lists (allow fixes words caught by mistake, like place names).", min: "Admin" },
      { cmd: "/automod rule · exempt", what: "Turn rules on or off, or let a channel skip AutoMod.", min: "Admin" },
    ],
  },
  {
    key: "server",
    title: "Economy & server setup",
    icon: "settings",
    about: "Admin tools for balances, items and the server's built-in panels.",
    commands: [
      { cmd: "/economy add · remove · set · reset", what: "Change someone's leaves.", min: "Admin" },
      { cmd: "/xpadmin add · remove · set · /leveladmin", what: "Change someone's XP or level.", min: "Admin" },
      { cmd: "/inventoryadmin view · history · add · remove", what: "See or change what someone owns from the store.", min: "Admin" },
      { cmd: "/storeadmin", what: "Force a new daily or weekly store rotation.", min: "Admin" },
      { cmd: "/qotd_post", what: "Post a Question of the Day now.", min: "Admin" },
      { cmd: "/deploy_roles · /deploy_nsfw_roles", what: "Repost the role selector galleries.", min: "Admin" },
      { cmd: "/discord create_support_panel · create_staff_panel · create_nsfw_panel", what: "Repost the ticket panels.", min: "Admin" },
      { cmd: "/restartsystem", what: "Restart one of the bots on the host.", min: "Admin" },
    ],
  },
];

export type GuideSection = { key: string; title: string; min: RankName; points: string[] };

/** How-tos: what to do, not just which command. */
export const SECTIONS: GuideSection[] = [
  {
    key: "start",
    title: "Your first week",
    min: "Helper",
    points: [
      "Your job is to keep the Kingdom cozy: welcome people, answer questions and nudge chat back on track before anything gets serious.",
      "Most spam, slurs, scam links and invites are handled by AutoMod automatically. You don't need to punish what it already caught.",
      "When you're unsure, ask in the staff channels. Nobody minds a question; a wrong ban is much harder to undo.",
      "Everything you do with a bot is logged with your name: punishments, ticket claims and application reviews all count toward your activity.",
    ],
  },
  {
    key: "punishing",
    title: "Handling a problem",
    min: "Helper",
    points: [
      "Start with the lightest step that fixes it: a friendly word in chat, then /warn, then /tempmute. Bans are for serious or repeated problems.",
      "Always give a clear reason. The member sees it, it's on their record, and admins read it if they appeal.",
      "Check /punishments <user> first: someone with a long record needs a different response than a first-timer.",
      "Never punish another staff member yourself. Only the Owner can mute or ban staff; bring it to an admin.",
      "Members can appeal bans, kicks, mutes and warnings on the website. Admins decide appeals, so write reasons you'd be happy for them to read.",
    ],
  },
  {
    key: "applications",
    title: "Reviewing join applications",
    min: "Helper",
    points: [
      "Applications show up in the Discord applications channel and on the website's Join Apps tab. Members are told we review within 24 hours.",
      "Check the age and birthday (18+ only), that the password from the rules is right, and that the answers are real effort.",
      "Accept, deny with a reason (they can see it and fix it), or ban for raiders and trolls. Underage forms are kicked automatically.",
      "Use /resetverification if someone was denied and should be allowed to try again straight away.",
    ],
  },
  {
    key: "tickets",
    title: "Working tickets",
    min: "Helper",
    points: [
      "Claim a ticket before you start so two people don't answer the same one.",
      "Keep everything in the ticket. Members get a transcript when it's closed and can read it on the website.",
      "For 18+ verification, check the ID or proof the way the team has agreed, then run /nsfwverify (Jr Mod and up) or ask someone who can.",
      "Close tickets once they're done; leaving them open makes the queue look busier than it is.",
    ],
  },
  {
    key: "channels",
    title: "Keeping chat calm",
    min: "Jr Mod",
    points: [
      "If a channel is heating up, slowmode is usually enough. Lock it only when people won't calm down, and set a time so it reopens on its own.",
      "Use /clear and /clearall to tidy up after spam or a fight. A transcript is kept, so nothing is lost for the record.",
    ],
  },
  {
    key: "bans",
    title: "Banning",
    min: "Mod",
    points: [
      "Ban for raiders, scammers, anyone underage, and serious or repeated rule breaking after warnings and mutes.",
      "Decide whether the ban is appealable. Most should be; leave appeals off only for things like raids, scams or anyone underage.",
      "The member gets a DM with the reason, the case ID and how to appeal. The staff log keeps the full record.",
    ],
  },
  {
    key: "raids",
    title: "Raids",
    min: "Helper",
    points: [
      "Turn on raid mode (/automod raidmode) as soon as you see a raid. It tightens AutoMod but never kicks or bans on its own.",
      "Ping an admin. Admins can run /lockdown to pause invites and auto-kick new joins.",
      "Don't argue with raiders. Delete, mute and move on.",
    ],
  },
  {
    key: "admin",
    title: "Running the team",
    min: "Admin",
    points: [
      "Decide appeals on the website's Appeals tab. The member is told the result (by email if they left one).",
      "Change AutoMod rules and word lists on the website's AutoMod tab; every change is logged.",
      "Approve news posts on the News tab, and keep an eye on Tickets, Accounts and Traffic.",
      "The Overview and each staff member's activity show who's pulling their weight.",
    ],
  },
];

/** The website panel tabs a level can open. */
export const PANEL_TABS = {
  staff: ["Overview", "Punishments", "AutoMod", "Join Apps", "Logs", "Social", "Games", "Live Chat", "Staff Guide"],
  admin: ["Appeals", "Messages", "Tickets", "Accounts", "News", "Traffic"],
};
