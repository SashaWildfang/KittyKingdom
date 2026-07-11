# Kitty Kingdom

Fall-themed Next.js landing page for the Kitty Kingdom furry Minecraft community.

## Account flow

- Register with email, confirm email, and password.
- Users receive an email confirmation link before they can log in.
- Login accepts email + password or username + password after a username is created.
- Signed-in users can create a username in account settings.
- Signed-in users can link Discord in account settings.

## Environment variables

Required for account storage and sessions:

- `DATABASE_URL`
- `AUTH_SECRET`
- `MONGODB_DB` optional; defaults to `kittykingdom`

Required for email confirmation through Resend:

- `RESEND_API_KEY`
- `EMAIL_FROM`

Required for Discord linking:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_GUILD_ID` optional, but set it to require membership in the Kitty Kingdom Discord server
- `DISCORD_BOT_TOKEN` optional; enables leaderboards to resolve live server display names and hide members who left the server

The current account implementation writes users to the `users` collection in MongoDB. Discord bot-specific behavior can be added after the bot/guild requirements are finalized.
