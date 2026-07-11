"use client";

export function DiscordUnlinkForm() {
  return (
    <form
      action="/api/account/discord/unlink"
      method="post"
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Unlinking Discord will remove Discord-only features from your account and you will be unable to access them until you link Discord again. Continue?",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <button className="discord-unlink-button" type="submit">
        Unlink Discord
      </button>
    </form>
  );
}
