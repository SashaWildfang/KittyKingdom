// The owner's resume (updated October 2026): shown at /owner/resume and used by the Project Guide's
// "About me". Text uses **bold**. The street address is left off the web version on purpose.

export type Job = { title: string; org: string; place: string; dates: string; points: string[] };

export const RESUME = {
  name: "Sasha Alexander Wildfang",
  short: "Sasha Wildfang",
  location: "Missoula, MT",
  phone: "(843) 310-0117",
  email: "justadevcontact@gmail.com",
  objective:
    "Software developer with a B.S. in Computer Science and hands-on full-stack experience in TypeScript, React, Node.js, Python and MongoDB. I designed, built and run Kitty Kingdom, a live platform with a web app, background services and a cloud database. I'm looking to bring that technical skill, plus disciplined leadership from years in fast-paced team roles, to an engineering team building impactful, user-centric products.",
  education: [
    {
      school: "Clemson University",
      place: "Clemson, SC",
      detail: "Bachelor of Science in Computer Science",
      dates: "Aug 2024",
      points: ["Relevant coursework: Artificial Intelligence, Eye Tracking Methodology (Biometrics), **Web Application Design** and **Database Management Systems**"],
    },
    {
      school: "Trident Technical College",
      place: "North Charleston, SC",
      detail: "Charleston Regional Youth Apprenticeship Program in Computer Networking",
      dates: "Aug 2018 – Jun 2020",
      points: ["Selected for the program while a student at Wando High School; Dean's List Fall 2018 – Spring 2020, GPA **3.90 / 4.00**"],
    },
  ],
  skills: [
    ["Programming languages", "TypeScript, JavaScript (ES6+), Python, Java, C, C++, SQL, HTML, CSS"],
    ["Frameworks & libraries", "React, Next.js, Node.js, Express.js, Flask, discord.py, REST APIs, Pandas, NumPy"],
    ["Databases", "MongoDB, MySQL, PostgreSQL, SQLAlchemy"],
    ["Cloud & DevOps", "Vercel (serverless), AWS (S3, Lambda, API Gateway), Docker, Jenkins, CI/CD pipelines"],
    ["Version control", "Git (branching, merging, conflict resolution), GitHub, GitHub Actions, GitLab"],
    ["Methodologies", "Agile, Scrum, Test-Driven Development, Continuous Integration / Continuous Deployment"],
    ["Tools & platforms", "VS Code, IntelliJ IDEA, NinjaRMM, JAMF, ITGlue, Zendesk"],
    ["AI & data", "scikit-learn, TensorFlow, Keras, Matplotlib, Seaborn"],
    ["Soft skills", "Leadership, team management, training and mentoring, process optimization, customer-facing communication"],
  ] as [string, string][],
  technical: [
    {
      title: "Founder & Full-Stack Developer",
      org: "Kitty Kingdom",
      place: "Remote",
      dates: "Apr 2025 – Present",
      points: [
        "Designed, built and run a full-stack community platform: a **Next.js / React / TypeScript** web app with **134 serverless API endpoints**, four **Python** background services and a shared **MongoDB Atlas** database",
        "Built **message-queue workflows** connecting the website and services (approvals, reminders, live settings), with claiming, status tracking and failure handling",
        "Implemented secure accounts from scratch: **scrypt** password hashing, HMAC-signed sessions, **two-factor login (TOTP)** and database-backed rate limiting",
        "Built real-time features including live multiplayer games with spectating, live leaderboards and staff moderation tools",
        "Ship every change through **GitHub pull requests** with automated checks, preview deployments and continuous deployment (**338+ commits** to the website)",
      ],
    },
    {
      title: "IT Intern / Apprentice",
      org: "Southern Eagle Distributing",
      place: "Charleston, SC",
      dates: "Sept 2018 – Aug 2020",
      points: [
        "Optimized **MySQL** database tables, reducing query response time by **20%** and improving data operations across multiple departments",
        "Developed a custom asset tracking system in ITGlue, reducing lost assets by **30%** and improving inventory accuracy",
        "Led the integration of remote monitoring through NinjaRMM, improving server downtime detection and reducing critical issues by **15%**",
        "Improved ticket resolution speed by **25%** by building Zendesk JSON API add-ons that streamlined IT support",
      ],
    },
    {
      title: "Java Developer",
      org: "Minehut",
      place: "Remote, UK",
      dates: "Jan 2017 – Jan 2018",
      points: [
        "Engineered core game mechanics for the Warzone CTF minigame, including flag capture, team balancing and custom power-ups, for thousands of players",
        "Designed and implemented custom **Java** plugins and server-side systems, including leaderboards and scoring",
        "Led performance optimization, reducing lag on high-traffic multiplayer servers",
        "Collaborated with a cross-functional team to improve features, fix bugs and integrate player feedback",
      ],
    },
  ] as Job[],
  work: [
    {
      title: "Security Officer",
      org: "GDI Ainsworth · Southgate Mall",
      place: "Missoula, MT",
      dates: "Jul 2026 – Present",
      points: [
        "Patrol and monitor the property to keep shoppers, tenants and staff safe",
        "Respond to incidents and write clear, accurate incident reports",
        "Assist guests and coordinate with mall management and emergency services when needed",
      ],
    },
    {
      title: "Team Lead / Shift Leader (Transitional)",
      org: "Chick-fil-A",
      place: "Jacksonville, FL",
      dates: "Aug 2025 – Feb 2026",
      points: [
        "Recruited as a Shift Leader to provide immediate operational support and leadership to the front-of-house team during a high-volume period",
        "Managed multi-channel order flows to meet the location's standards for speed, accuracy and hospitality",
        "Worked with senior management to refine service workflows, contributing to a consistent 5-star guest experience",
      ],
    },
    {
      title: "Shift Leader",
      org: "Dunkin'",
      place: "Pendleton, SC",
      dates: "Feb 2025 – Jul 2025",
      points: [
        "Directed daily operations for a fast-paced crew, keeping speed of service and quality consistent during peak rushes",
        "Coached team members on accuracy and guest service, and managed cash handling and drawer reconciliations",
      ],
    },
    {
      title: "Team Member",
      org: "Zaxby's",
      place: "Pendleton, SC",
      dates: "Nov 2024 – Dec 2024",
      points: ["Managed multi-channel orders (in-store, mobile and drive-thru) during the holiday peak, consistently meeting service time targets"],
    },
    {
      title: "Restaurant Lead (promoted May 2023)",
      org: "Chick-fil-A",
      place: "Clemson, SC",
      dates: "May 2022 – Aug 2024",
      points: [
        "Managed day-to-day operations of a high-volume restaurant, driving a **15%** improvement in shift efficiency",
        "Worked an average of **40 hours a week** while carrying a full college course load",
        "Trained and mentored **25+ team members**, reducing training time by **20%** and raising productivity by **10%**",
        "Led a customer experience initiative that cut customer complaints by **25%**",
        "Handled and reconciled **$10,000+** in daily transactions with 100% accuracy",
      ],
    },
  ] as Job[],
};
