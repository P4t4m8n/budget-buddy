// ---Next---
import Link from "next/link";

// ---Lib---
import { addMonths, parseMonth } from "@/lib/dates";
import { formatMonth } from "@/lib/format";

const link =
  "rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10";

// The real current month has no ?month=, so its address stays /budget
const hrefFor = (month: string, thisMonth: string) =>
  month === thisMonth ? "/budget" : `/budget?month=${month}`;

export default function MonthNav({
  month,
  thisMonth,
}: {
  month: string;
  thisMonth: string;
}) {
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);

  return (
    <nav aria-label="Month" className="mb-6 flex flex-wrap items-center gap-2">
      {parseMonth(previous) ? (
        <Link
          href={hrefFor(previous, thisMonth)}
          aria-label="Previous month"
          className={link}
        >
          ‹
        </Link>
      ) : (
        <span aria-hidden="true" className={`${link} opacity-30`}>
          ‹
        </span>
      )}
      <span
        aria-current="date"
        className="min-w-40 text-center text-lg font-semibold"
      >
        {formatMonth(month)}
      </span>
      {parseMonth(next) ? (
        <Link
          href={hrefFor(next, thisMonth)}
          aria-label="Next month"
          className={link}
        >
          ›
        </Link>
      ) : (
        <span aria-hidden="true" className={`${link} opacity-30`}>
          ›
        </span>
      )}
      {month !== thisMonth && (
        <Link href="/budget" className={`${link} text-emerald-400`}>
          This month
        </Link>
      )}
    </nav>
  );
}
