
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 overflow-x-hidden p-6 lg:p-8">{children}</main>
  );
}
