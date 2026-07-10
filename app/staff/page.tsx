import Link from "next/link";

const staff = [
  {
    name: "SashaWildfang",
    role: "Owner",
    bio: "Leads Kitty Kingdom, listens to community feedback, and keeps the server moving forward.",
  },
  {
    name: "Moderation Team",
    role: "Staff",
    bio: "Helps keep verification, AutoMod, events, and member safety running smoothly.",
  },
  {
    name: "Community Helpers",
    role: "Support",
    bio: "Welcomes new members, answers questions, and helps the community feel like home.",
  },
];

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
        <div className="staff-grid">
          {staff.map((member) => (
            <article className="staff-card" key={member.name}>
              <img src="/logo.png" alt="" />
              <div>
                <span>{member.role}</span>
                <h2>{member.name}</h2>
                <p>{member.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
