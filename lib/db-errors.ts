export function isDatabaseConnectionError(error: unknown) {
  if (!(error instanceof Error)) return false;

  return (
    error.name === "MongoServerSelectionError" ||
    error.message.includes("Server selection timed out") ||
    error.message.includes("ReplicaSetNoPrimary")
  );
}
