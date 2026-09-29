import { redirect } from "next/navigation";

// Social settings moved to Settings (the gear next to the bell); old links keep working
export default function SocialSettingsMoved() {
  redirect("/settings");
}
