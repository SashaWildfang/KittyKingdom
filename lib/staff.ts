import { getStaffCollection } from "./mongodb";

export type StaffStatus = "online" | "idle" | "dnd" | "offline";

export type StaffMember = {
  id: string;
  name: string;
  username: string | null;
  role: string;
  roleColor: string | null;
  rank: number;
  avatarUrl: string;
  status: StaffStatus | null;
  bio: string;
  memberSince: Date | null;
  /** When they were last seen online (kept up to date by the bot's staff sync). */
  lastOnline: string | null;
};

export type StaffGroup = {
  title: string;
  description: string;
  icon: string;
  members: StaffMember[];
};

// How ranks are grouped on the page (rank order comes from the bot)
const GROUPS: { title: string; description: string; icon: string; roles: string[] }[] = [
  { title: "Administration", description: "Leads the kingdom and keeps everything running.", icon: "crown", roles: ["Owner", "Sr Admin", "Admin"] },
  { title: "Moderation", description: "Keeps channels safe, friendly, and fun.", icon: "shield", roles: ["Sr Mod", "Mod", "Jr Mod"] },
  { title: "Community", description: "Runs events and announcements and keeps the kingdom buzzing.", icon: "megaphone", roles: ["Community Manager"] },
  { title: "Helper Team", description: "Your first stop for questions and verification.", icon: "leaf", roles: ["Helper"] },
  { title: "Staff", description: "Members of the Kitty Kingdom staff team.", icon: "sparkles", roles: ["Staff"] },
  { title: "Content Creators", description: "Make videos, art and posts about Kitty Kingdom. Go show them some love!", icon: "video", roles: ["Content Creator"] },
];

const ROLE_BIOS: Record<string, string> = {
  Owner: "Leads Kitty Kingdom and keeps the community moving forward.",
  "Sr Admin": "Supports moderation, community safety, and server operations.",
  Admin: "Helps manage the community and keeps things running smoothly.",
  "Sr Mod": "Guides the moderation team and keeps the community safe.",
  Mod: "Moderates channels and supports members day to day.",
  "Community Manager": "Plans events, posts announcements and keeps the community buzzing.",
  "Content Creator": "Creates videos, art and posts for Kitty Kingdom and its socials.",
  "Jr Mod": "Helps welcome members and keep the community safe.",
  Helper: "Helps members, answers questions, and keeps the kingdom welcoming.",
  Staff: "Part of the team keeping the kingdom safe and welcoming.",
};

// Personal bios written before the page went live. A "bio" field on a staff document overrides these.
const PERSONAL_BIOS: Record<string, string> = {
  "164577223162986498": "Leads Kitty Kingdom and keeps the community moving forward.",
  "128584992115785728": "Supports moderation, community safety, and server operations.",
  "507882987023761438": "Helps manage the community and keeps things running smoothly.",
  "790250289382162442": "Moderates channels and supports members day to day.",
  "972010676543422505": "Helps welcome members and keep the community safe.",
  "178046006640902144": "Supports verification, events, and community moderation.",
  "847578158420852746": "Helps maintain a friendly and active community space.",
  "468613389401194506": "Assists members and supports the moderation team.",
  "553778537459613709": "Helps members, answers questions, and keeps the kingdom welcoming.",
};

// Shown only if the live list can't be loaded, so the page is never empty
const FALLBACK: { name: string; role: string; id: string }[] = [
  { name: "Sasha", role: "Owner", id: "164577223162986498" },
  { name: "Dustin", role: "Sr Admin", id: "128584992115785728" },
  { name: "Derringer", role: "Admin", id: "507882987023761438" },
  { name: "SlshRsh", role: "Mod", id: "790250289382162442" },
  { name: "Cat", role: "Jr Mod", id: "972010676543422505" },
  { name: "Keiko", role: "Jr Mod", id: "178046006640902144" },
  { name: "Nox", role: "Jr Mod", id: "847578158420852746" },
  { name: "Spindle", role: "Jr Mod", id: "468613389401194506" },
  { name: "YeetACookie", role: "Helper", id: "553778537459613709" },
];
const FALLBACK_RANK = ["Owner", "Sr Admin", "Admin", "Sr Mod", "Mod", "Community Manager", "Jr Mod", "Helper", "Staff", "Content Creator"];

function bioFor(id: string, role: string, custom: unknown) {
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  return PERSONAL_BIOS[id] ?? ROLE_BIOS[role] ?? ROLE_BIOS.Staff;
}

function toStatus(value: unknown): StaffStatus | null {
  return value === "online" || value === "idle" || value === "dnd" || value === "offline" ? value : null;
}

function groupMembers(members: StaffMember[]): StaffGroup[] {
  return GROUPS.map((group) => ({
    title: group.title,
    description: group.description,
    icon: group.icon,
    members: members
      .filter((m) => group.roles.includes(m.role) || (group.title === "Staff" && !GROUPS.some((g) => g.roles.includes(m.role))))
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)),
  })).filter((group) => group.members.length > 0);
}

export type StaffDirectory = {
  groups: StaffGroup[];
  total: number;
  online: number | null;
  updatedAt: Date | null;
  live: boolean;
};

export async function getStaffDirectory(): Promise<StaffDirectory> {
  try {
    const docs = await (await getStaffCollection()).find({}).toArray();
    if (docs.length > 0) {
      const members: StaffMember[] = docs.map((doc) => {
        const id = String(doc.discord_id ?? doc._id);
        const role = typeof doc.role === "string" ? doc.role : "Staff";
        return {
          id,
          name: String(doc.display_name ?? doc.username ?? "Staff member"),
          username: typeof doc.username === "string" ? doc.username : null,
          role,
          roleColor: typeof doc.role_color === "string" ? doc.role_color : null,
          rank: typeof doc.rank === "number" ? doc.rank : 99,
          avatarUrl: typeof doc.avatar_url === "string" ? doc.avatar_url : `/api/discord/avatar/${id}`,
          status: toStatus(doc.status),
          bio: bioFor(id, role, doc.bio),
          memberSince: doc.joined_server_at instanceof Date ? doc.joined_server_at : null,
          lastOnline: doc.last_online_at instanceof Date ? doc.last_online_at.toISOString() : null,
        };
      });
      const synced = docs.map((d) => d.synced_at).filter((d): d is Date => d instanceof Date);
      return {
        groups: groupMembers(members),
        total: members.length,
        online: members.filter((m) => m.status && m.status !== "offline").length,
        updatedAt: synced.length ? new Date(Math.max(...synced.map((d) => d.getTime()))) : null,
        live: true,
      };
    }
  } catch (error) {
    console.error("Staff list unavailable, showing fallback", error);
  }

  const members: StaffMember[] = FALLBACK.map((m) => ({
    id: m.id,
    name: m.name,
    username: null,
    role: m.role,
    roleColor: null,
    rank: FALLBACK_RANK.indexOf(m.role),
    avatarUrl: `/api/discord/avatar/${m.id}`,
    status: null,
    bio: bioFor(m.id, m.role, null),
    memberSince: null,
    lastOnline: null,
  }));
  return { groups: groupMembers(members), total: members.length, online: null, updatedAt: null, live: false };
}
