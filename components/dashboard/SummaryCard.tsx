export default function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass = {
    neutral: "text-neutral-100",
    positive: "text-emerald-400",
    negative: "text-red-400",
  }[tone];

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
