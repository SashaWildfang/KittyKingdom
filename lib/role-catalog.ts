// Self-assignable roles, generated from the bot's role selectors
// (main_bot/cmds/selector.py and nsfw_selector.py). Keep in sync when those change.
// Only roles listed here can be added or removed from the website.

export type SelfRole = { id: string; name: string; emoji: string; description: string };
export type SelfRoleCategory = {
  key: string;
  title: string;
  description: string;
  color: string;
  /** 18+ categories: only members with the 18+ Verified role can use them. */
  adult: boolean;
  roles: SelfRole[];
};

export const ROLE_CATEGORIES: SelfRoleCategory[] = [
  {
    "key": "Gender",
    "title": "Gender",
    "description": "Select your gender identity to help others know who you are.",
    "color": "#5dade2",
    "adult": false,
    "roles": [
      {
        "id": "1358469893451682104",
        "name": "Male",
        "emoji": "🚹",
        "description": "Select this if you identify as male."
      },
      {
        "id": "1358469917850206368",
        "name": "Female",
        "emoji": "🚺",
        "description": "Select this if you identify as female."
      },
      {
        "id": "1358470568340623432",
        "name": "Nonbinary",
        "emoji": "⚧️",
        "description": "Select this if you identify outside the gender binary."
      },
      {
        "id": "1358470591237062846",
        "name": "Trans (MtF)",
        "emoji": "🏳️‍⚧️",
        "description": "Male to Female transgender identity."
      },
      {
        "id": "1358470617476894862",
        "name": "Trans (FtM)",
        "emoji": "🏳️‍⚧️",
        "description": "Female to Male transgender identity."
      },
      {
        "id": "1495855560527052881",
        "name": "Intersex",
        "emoji": "🟡",
        "description": "Select this if you are intersex."
      },
      {
        "id": "1358470654755864647",
        "name": "Other Gender",
        "emoji": "❓",
        "description": "Any identity not listed above."
      }
    ]
  },
  {
    "key": "Pronouns",
    "title": "Pronouns",
    "description": "Let us know which pronouns you prefer we use for you.",
    "color": "#48c9b0",
    "adult": false,
    "roles": [
      {
        "id": "1358470364866547994",
        "name": "He/Him",
        "emoji": "💬",
        "description": "Standard masculine pronouns."
      },
      {
        "id": "1358470384025866311",
        "name": "She/Her",
        "emoji": "💬",
        "description": "Standard feminine pronouns."
      },
      {
        "id": "1358470488984391921",
        "name": "They/Them",
        "emoji": "💬",
        "description": "Gender-neutral pronouns."
      },
      {
        "id": "1358470508940890182",
        "name": "Any Pronouns",
        "emoji": "🌈",
        "description": "You are comfortable with any pronouns."
      },
      {
        "id": "1498070570900783256",
        "name": "Ask Pronouns",
        "emoji": "❓",
        "description": "Please ask for my preferred pronouns."
      }
    ]
  },
  {
    "key": "Sexuality",
    "title": "Sexuality",
    "description": "Identify your orientation within the community.",
    "color": "#af7ac5",
    "adult": false,
    "roles": [
      {
        "id": "1358471129915723949",
        "name": "Gay",
        "emoji": "🏳️‍🌈",
        "description": "Attraction to the same gender."
      },
      {
        "id": "1358471298837250118",
        "name": "Bisexual",
        "emoji": "💖",
        "description": "Attraction to two or more genders."
      },
      {
        "id": "1358471351182033089",
        "name": "Pansexual",
        "emoji": "💛",
        "description": "Attraction regardless of gender."
      },
      {
        "id": "1358471374515081597",
        "name": "Asexual",
        "emoji": "🖤",
        "description": "Little to no sexual attraction."
      },
      {
        "id": "1495855107580100708",
        "name": "Aromantic",
        "emoji": "💚",
        "description": "Little to no romantic attraction."
      },
      {
        "id": "1358471406626537663",
        "name": "Straight",
        "emoji": "👫",
        "description": "Attraction to the opposite gender."
      },
      {
        "id": "1358471428902490272",
        "name": "Questioning",
        "emoji": "🔍",
        "description": "Currently exploring your orientation."
      },
      {
        "id": "1358819082790637768",
        "name": "Demisexual",
        "emoji": "💜",
        "description": "Attraction only after a strong bond."
      }
    ]
  },
  {
    "key": "Location",
    "title": "Location",
    "description": "General region you reside in.",
    "color": "#f4d03f",
    "adult": false,
    "roles": [
      {
        "id": "1358474003831849091",
        "name": "United States",
        "emoji": "🇺🇸",
        "description": "Located in the USA."
      },
      {
        "id": "1358819870392717446",
        "name": "Canada",
        "emoji": "🇨🇦",
        "description": "Located in Canada."
      },
      {
        "id": "1358474080080232739",
        "name": "Europe",
        "emoji": "🇪🇺",
        "description": "Located in Europe."
      },
      {
        "id": "1358474114658209942",
        "name": "Asia",
        "emoji": "🌏",
        "description": "Located in Asia."
      },
      {
        "id": "1358474136292294667",
        "name": "Oceania",
        "emoji": "🇦🇺",
        "description": "Located in Australia/Oceania."
      },
      {
        "id": "1358474162691375284",
        "name": "South America",
        "emoji": "🇧🇷",
        "description": "Located in South America."
      },
      {
        "id": "1358474188242948318",
        "name": "Africa",
        "emoji": "🌍",
        "description": "Located in Africa."
      }
    ]
  },
  {
    "key": "Timezone",
    "title": "Timezone",
    "description": "Helps others know when you are awake and active.",
    "color": "#2e4053",
    "adult": false,
    "roles": [
      {
        "id": "1358474214113411234",
        "name": "EST",
        "emoji": "⏰",
        "description": "Eastern Standard Time."
      },
      {
        "id": "1358474240004853991",
        "name": "CST",
        "emoji": "⏰",
        "description": "Central Standard Time."
      },
      {
        "id": "1358474264260645067",
        "name": "MST",
        "emoji": "⏰",
        "description": "Mountain Standard Time."
      },
      {
        "id": "1358474285248938024",
        "name": "PST",
        "emoji": "⏰",
        "description": "Pacific Standard Time."
      },
      {
        "id": "1358474323018649677",
        "name": "GMT",
        "emoji": "🌐",
        "description": "Greenwich Mean Time."
      },
      {
        "id": "1358474345810231529",
        "name": "CET",
        "emoji": "🌐",
        "description": "Central European Time."
      },
      {
        "id": "1358474403997946037",
        "name": "AEST",
        "emoji": "🇦🇺",
        "description": "Australian Eastern Standard Time."
      },
      {
        "id": "1488179988497956904",
        "name": "AKST",
        "emoji": "🌐",
        "description": "Alaska Standard Time."
      }
    ]
  },
  {
    "key": "Preferences",
    "title": "Preferences",
    "description": "Your personal boundaries for DMs and Pings.",
    "color": "#ccd1d1",
    "adult": false,
    "roles": [
      {
        "id": "1358476316437123108",
        "name": "DMs Open",
        "emoji": "🔓",
        "description": "Anyone can message you."
      },
      {
        "id": "1358476342924021790",
        "name": "DMs Closed",
        "emoji": "🔒",
        "description": "Please do not DM me."
      },
      {
        "id": "1358476363329310930",
        "name": "Ask to DM",
        "emoji": "✉️",
        "description": "Please ask in public before DMing."
      },
      {
        "id": "1358476383650840848",
        "name": "Ping Me",
        "emoji": "🔔",
        "description": "You are okay with being mentioned."
      },
      {
        "id": "1358476416148307988",
        "name": "Dont Ping Me",
        "emoji": "🔕",
        "description": "Please avoid pinging me directly."
      }
    ]
  },
  {
    "key": "Hobbies",
    "title": "Hobbies",
    "description": "What are your interests and hobbies?",
    "color": "#1e8449",
    "adult": false,
    "roles": [
      {
        "id": "1358476638957994085",
        "name": "Writer",
        "emoji": "✍️",
        "description": "You enjoy creative writing or poetry."
      },
      {
        "id": "1358476684159877291",
        "name": "Musician",
        "emoji": "🎵",
        "description": "You play instruments or produce music."
      },
      {
        "id": "1358476726287601818",
        "name": "Pet Owner",
        "emoji": "🐾",
        "description": "You have animal companions."
      },
      {
        "id": "1358476748525797396",
        "name": "Fursuiter",
        "emoji": "🦊",
        "description": "You own or enjoy fursuiting."
      },
      {
        "id": "1358476780616548555",
        "name": "Stoner Furry",
        "emoji": "🌿",
        "description": "420-friendly lifestyle."
      },
      {
        "id": "1358476825650794667",
        "name": "Fitness Furry",
        "emoji": "💪",
        "description": "Interested in gym or athletics."
      },
      {
        "id": "1358476461765431356",
        "name": "PC Gamer",
        "emoji": "💻",
        "description": "You play games on PC."
      },
      {
        "id": "1504466095082573917",
        "name": "Console Gamer",
        "emoji": "🎮",
        "description": "You play games on a console."
      },
      {
        "id": "1358476558754517143",
        "name": "Mobile Gamer",
        "emoji": "📱",
        "description": "You play on phone or tablet."
      }
    ]
  },
  {
    "key": "Pings",
    "title": "Pings",
    "description": "Manage your notification pings for server activity.",
    "color": "#e74c3c",
    "adult": false,
    "roles": [
      {
        "id": "1363972389188276264",
        "name": "Welcome Ping",
        "emoji": "👋",
        "description": "Pings when new members join."
      },
      {
        "id": "1363972415822237747",
        "name": "Announcements",
        "emoji": "📢",
        "description": "General server news and updates."
      },
      {
        "id": "1488184349286338892",
        "name": "Chat Revive",
        "emoji": "🔥",
        "description": "Pings to bring life back to the chat."
      },
      {
        "id": "1552130421343395871",
        "name": "QOTD Ping",
        "emoji": "❓",
        "description": "Pings when a new Question of the Day is posted."
      }
    ]
  },
  {
    "key": "Relationship_Type",
    "title": "Relationship Type",
    "description": "How do you prefer to structure your relationships?",
    "color": "#e91e63",
    "adult": true,
    "roles": [
      {
        "id": "1358471476679934074",
        "name": "Monogamous",
        "emoji": "💍",
        "description": "Dedicated to one partner."
      },
      {
        "id": "1358471502575571214",
        "name": "Polyamorous",
        "emoji": "🌈",
        "description": "Open to multiple romantic partners."
      },
      {
        "id": "1358471533642776758",
        "name": "Open Relationship",
        "emoji": "🔓",
        "description": "Committed but sexually open."
      },
      {
        "id": "1358471579033670004",
        "name": "Closed Relationship",
        "emoji": "🔒",
        "description": "Not looking for outside additions."
      }
    ]
  },
  {
    "key": "Relationship_Status",
    "title": "Relationship Status",
    "description": "What is your current availability?",
    "color": "#9b59b6",
    "adult": true,
    "roles": [
      {
        "id": "1358471717764468997",
        "name": "Taken",
        "emoji": "❤️",
        "description": "Currently in a relationship."
      },
      {
        "id": "1359165195536171048",
        "name": "Looking",
        "emoji": "🔍",
        "description": "Seeking new connections."
      },
      {
        "id": "1358471668695171072",
        "name": "Not Looking",
        "emoji": "🚫",
        "description": "Not currently seeking anyone."
      }
    ]
  },
  {
    "key": "Looking_For",
    "title": "Looking For",
    "description": "Specify what or who you are looking for.",
    "color": "#f1c40f",
    "adult": true,
    "roles": [
      {
        "id": "1358471789595988224",
        "name": "Partner",
        "emoji": "🔥",
        "description": "Seeking a romantic partner."
      },
      {
        "id": "1358471820575248688",
        "name": "Friends",
        "emoji": "🫂",
        "description": "Seeking platonic friendships."
      },
      {
        "id": "1358484800507216039",
        "name": "Poly Connections",
        "emoji": "🧬",
        "description": "Seeking polyamorous dynamics."
      },
      {
        "id": "1358484767565152447",
        "name": "Mono Connections",
        "emoji": "💍",
        "description": "Seeking monogamous dynamics."
      }
    ]
  },
  {
    "key": "Positions",
    "title": "Positions",
    "description": "Your preferred role in the bedroom.",
    "color": "#2ecc71",
    "adult": true,
    "roles": [
      {
        "id": "1358477166253310102",
        "name": "Top",
        "emoji": "⬆️",
        "description": "Preferring the giving role."
      },
      {
        "id": "1358477245307424798",
        "name": "Bottom",
        "emoji": "⬇️",
        "description": "Preferring the receiving role."
      },
      {
        "id": "1358477262869102744",
        "name": "Switch",
        "emoji": "🔄",
        "description": "Comfortable with both roles."
      },
      {
        "id": "1359174049292620008",
        "name": "Vers Top",
        "emoji": "🔼",
        "description": "Versatile, but prefers topping."
      },
      {
        "id": "1359174111007342813",
        "name": "Vers Bottom",
        "emoji": "🔽",
        "description": "Versatile, but prefers bottoming."
      }
    ]
  }
];

export const SELF_ROLE_IDS = new Set(ROLE_CATEGORIES.flatMap((c) => c.roles.map((r) => r.id)));
export const ADULT_ROLE_IDS = new Set(ROLE_CATEGORIES.filter((c) => c.adult).flatMap((c) => c.roles.map((r) => r.id)));
