"use client";

import { Wand2 } from "lucide-react";
import { ProfileScreen } from "../profile-view";
import { Empty, useApi } from "../ui";

/** My profile: exactly what other members see, with an Edit profile button. */
export default function MyProfile() {
  const { data, error } = useApi<{ view: { id: string } | null }>("/api/dating/me");
  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading dt-loading--tall" aria-busy="true" />;
  if (!data.view)
    return (
      <Empty icon={<Wand2 size={28} />} title="You don't have a profile yet">
        <p>Make one in a few minutes to find dates and friends.</p>
        <a className="dt-btn" href="/social/setup">
          Create my profile
        </a>
      </Empty>
    );
  return <ProfileScreen id={data.view.id} />;
}
