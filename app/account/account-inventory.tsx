"use client";

import { useEffect, useState } from "react";
import type { StoreState } from "../../lib/store";
import { StoreClient } from "../store/store-client";

/** Your inventory on My Account: equip roles, use boosters and send gifts without leaving the page. */
export function AccountInventory() {
  const [state, setState] = useState<StoreState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/store", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.ok) throw new Error(body.error ?? "Couldn't load your inventory.");
        setState(body.state);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your inventory."));
  }, []);

  if (error) return <p className="roles-muted">{error}</p>;
  if (!state) return <div className="adm-skeleton adm-skeleton--short" aria-label="Loading inventory" />;
  return <StoreClient initialState={state} inventoryOnly />;
}
