# Kitty Kingdom

Fall-themed Next.js landing page for the Kitty Kingdom furry Minecraft community.

## Planned backend hooks

The registration flow is scaffolded to require Discord before creating a user profile. Add these environment variables when wiring the backend:

- `DATABASE_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_GUILD_ID`

The current `/api/auth/discord` route redirects to Discord OAuth when the Discord client settings are present. The callback, database insert, and Discord.py bot handoff still need the exact bot/guild requirements.
