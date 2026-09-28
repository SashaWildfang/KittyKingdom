import { MessagesSquare } from "lucide-react";

export default function MessagesIndex() {
  return (
    <div className="dt-thread-empty">
      <MessagesSquare size={36} aria-hidden="true" />
      <h3>Your messages</h3>
      <p className="dt-muted">Pick a chat on the left. Matches and friends can talk freely; anyone else starts with a message request (up to 3 messages until they accept).</p>
    </div>
  );
}
