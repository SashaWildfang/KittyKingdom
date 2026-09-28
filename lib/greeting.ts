// My Account's welcome line, based on the member's own clock (their time zone cookie).

const LINES: Record<string, string[]> = {
  morning: [
    "Coffee's on and the kingdom is waking up. Here's everything in one place.",
    "Fresh start! Don't forget your Daily Reward today.",
    "The leaves are crisp this morning. Your account is ready when you are.",
  ],
  afternoon: [
    "Hope your day's going well. Here's your corner of the kingdom.",
    "Perfect time for a snack break and a quick look at your stats.",
    "The afternoon sun is out over the kingdom. Everything's right where you left it.",
  ],
  evening: [
    "Cozy evening vibes. Grab a blanket and settle in.",
    "The lanterns are lit. Chat's usually lively around now!",
    "Winding down? Your profile, roles and rewards are all here.",
  ],
  night: [
    "The kingdom never sleeps, and apparently neither do you. 🌙",
    "Late-night crew, we see you. Remember to rest those paws.",
    "The stars are out and the chat is cozy. Welcome in.",
  ],
};

export function accountGreeting(name: string, timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23", weekday: "long", day: "numeric" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = Number(parts.find((p) => p.type === "day")?.value ?? 1);
  const part = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 22 ? "evening" : "night";
  const title =
    part === "morning" ? `Good morning, ${name}` : part === "afternoon" ? `Good afternoon, ${name}` : part === "evening" ? `Good evening, ${name}` : `Hey night owl, ${name}`;
  const weekend = weekday === "Saturday" || weekday === "Sunday";
  // Same line all day (changes daily), so it doesn't flicker between page loads
  const lines = LINES[part];
  let line = lines[day % lines.length];
  if (weekday === "Friday" && part !== "morning") line = "Happy Friday! The weekend starts here. 🎉";
  else if (weekend && part === "morning") line = "Happy weekend! Take it slow and come hang out in chat.";
  const eyebrow = `${weekday} ${part === "night" ? "night" : part}`;
  return { title, line, eyebrow };
}
