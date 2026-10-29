export default function FieldError({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <span id={id} className="text-xs text-red-400">
      {children}
    </span>
  );
}
