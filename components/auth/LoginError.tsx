const messages: Record<string, string> = {
  access_denied: "Sign-in was cancelled. Try again whenever you're ready.",
  invalid_request: "The sign-in request was invalid or expired. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  server_error: "Something went wrong on our side. Please try again.",
};

export default async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error } = await searchParams;
  if (typeof error !== "string") return null;

  // Unknown codes get the generic message instead of echoing user input
  const message = Object.hasOwn(messages, error)
    ? messages[error]
    : messages.server_error;

  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
    >
      {message}
    </p>
  );
}
