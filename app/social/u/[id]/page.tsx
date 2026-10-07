import { ProfileScreen } from "../../profile-view";

export default async function ProfilePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ProfileScreen id={params.id} />;
}
