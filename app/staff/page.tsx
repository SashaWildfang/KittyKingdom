import Link from "next/link";

const groups = [
  {
    title: "Administration",
    members: [
      {
        name: "Sasha",
        role: "Owner",
        id: "164577223162986498",
        bio: "Leads Kitty Kingdom and keeps the community moving forward.",
      },
      {
        name: "Dustin",
        role: "Sr Admin",
        id: "128584992115785728",
        bio: "Supports moderation, community safety, and server operations.",
      },
      {
        name: "Derringer",
        role: "Admin",
        id: "507882987023761438",
        bio: "Helps manage the community and keeps things running smoothly.",
      },
    ],
  },
  {
    title: "Moderation",
    members: [
      {
        name: "SlshRsh",
        role: "Mod",
        id: "790250289382162442",
        bio: "Moderates channels and supports members day to day.",
      },
      {
        name: "Cat",
        role: "Jr Mod",
        id: "972010676543422505",
        bio: "Helps welcome members and keep the community safe.",
      },
      {
        name: "Keiko",
        role: "Jr Mod",
        id: "178046006640902144",
        bio: "Supports verification, events, and community moderation.",
      },
      {
        name: "Nox",
        role: "Jr Mod",
        id: "847578158420852746",
        bio: "Helps maintain a friendly and active community space.",
      },
      {
        name: "Spindle",
        role: "Jr Mod",
        id: "468613389401194506",
        bio: "Assists members and supports the moderation team.",
      },
    ],
  },
  {
    title: "Helper Team",
    members: [
      {
        name: "YeetACookie",
        role: "Helper",
        id: "553778537459613709",
        bio: "Helps members, answers questions, and keeps the kingdom welcoming.",
      },
    ],
  },
];

function avatarUrl(id: string) {
  return `/api/discord/avatar/${id}`;
}

export default function StaffPage() {
  return (
    <main className="legal-page">
      <section className="legal-card wide-card">
        <Link
          className="auth-logo"
          href="/home"
          aria-label="Kitty Kingdom home"
        >
          <img
            className="auth-logo-img"
            src="/logo.png"
            alt="Kitty Kingdom logo"
          />
        </Link>
        <p className="eyebrow">Staff</p>
        <h1>Meet the Kitty Kingdom Staff</h1>
        <p>The people helping keep the kingdom safe, active, and welcoming.</p>
        {groups.map((group) => (
          <section className="staff-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="staff-grid">
              {group.members.map((member) => (
                <article className="staff-card" key={member.id}>
                  <img
                    src={avatarUrl(member.id)}
                    alt={`${member.name} Discord avatar`}
                    width="88"
                    height="88"
                    loading="eager"
                    decoding="async"
                  />
                  <div>
                    <span>{member.role}</span>
                    <h3>{member.name}</h3>
                    <p>{member.bio}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
