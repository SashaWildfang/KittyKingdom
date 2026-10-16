"use client";

import { askConfirm } from "./confirm-dialog";

export function DiscordUnlinkForm() {
  return (
    <form
      action="/api/account/discord/unlink"
      method="post"
      onSubmit={(event) => {
        // Ask first (in the page), then send the form for real
        if (event.currentTarget.dataset.confirmed === "yes") return;
        event.preventDefault();
        const form = event.currentTarget;
        void askConfirm("Unlinking Discord will remove Discord-only features from your account and you will be unable to access them until you link Discord again. Continue?", {
          confirmLabel: "Unlink",
          danger: true,
        }).then((yes) => {
          if (!yes) return;
          form.dataset.confirmed = "yes";
          form.requestSubmit();
        });
      }}
    >
      <button className="discord-unlink-button" type="submit">
        Unlink Discord
      </button>
    </form>
  );
}
