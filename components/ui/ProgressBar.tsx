import { barColor } from "@/components/budget/bar-color";

// How much of a limit is used: green while there is room, amber near the limit, red over it
export default function ProgressBar({
  label,
  value,
  max,
}: {
  // What the bar measures, for screen readers
  label: string;
  value: number;
  max: number;
}) {
  const ratio = max > 0 ? value / max : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-2 overflow-hidden rounded-full bg-white/10"
    >
      <div
        className={`h-full rounded-full ${barColor(ratio)}`}
        style={{ width: `${Math.min(ratio, 1) * 100}%` }}
      />
    </div>
  );
}
