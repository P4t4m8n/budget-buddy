// Plain <a>, not <Link>: prefetching would call the OAuth start route and set cookies
export default function GoogleSignInButton() {
  return (
    <a
      href="/api/auth/google"
      className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3a7.2 7.2 0 0 1-10.72-3.77H1.37v3.09A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.34 14.32a7.2 7.2 0 0 1 0-4.64V6.59H1.37a12 12 0 0 0 0 10.82l3.97-3.09Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.43-3.43A12 12 0 0 0 1.37 6.59l3.97 3.09A7.2 7.2 0 0 1 12 4.75Z"
        />
      </svg>
      Continue with Google
    </a>
  );
}
