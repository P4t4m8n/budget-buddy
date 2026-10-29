export const inputClass =
  "w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-500 focus:border-emerald-500";

export default function FormField({
  label,
  labelId,
  children,
}: {
  label: string;
  // Lets a custom control (the MUI select) name itself with this label
  labelId?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}
