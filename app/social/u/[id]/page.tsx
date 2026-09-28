import { ProfileScreen } from "../../profile-view";

export default function ProfilePage({ params }: { params: { id: string } }) {
  return <ProfileScreen id={params.id} />;
}
