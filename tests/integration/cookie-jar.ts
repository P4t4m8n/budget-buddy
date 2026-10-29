// Imported by vi.mock("next/headers", ...) factories, so it must not import any app code:
// the session code imports next/headers, which would make the mock wait on itself.

// Stand-in for the browser's cookie jar
export const jar = new Map<string, string>();

export const nextHeadersMock = {
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => jar.delete(name),
  }),
};
