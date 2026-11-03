"use client";

import { LineChart } from "@mui/x-charts/LineChart";
import { formatCurrency } from "@/lib/format";
import type { InvestmentHistory } from "@/types/investments";

const money = (value: number | null) =>
  value === null ? "" : formatCurrency(value);

// "2026-10-28" -> "28 Oct 26": short enough for the axis, the tooltip keeps the full date
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`)
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });

// One line per investment, with a point for every day its value was recorded
export default function InvestmentHistoryChart({
  history,
}: {
  history: InvestmentHistory;
}) {
  return (
    <LineChart
      height={320}
      margin={{ right: 32 }}
      xAxis={[
        {
          scaleType: "point",
          data: history.dates,
          valueFormatter: (date: string, context) =>
            context.location === "tick" ? shortDate(date) : date,
        },
      ]}
      yAxis={[{ width: 64 }]}
      series={history.series.map((series) => ({
        id: series.id,
        label: series.label,
        data: series.data,
        showMark: true,
        // An investment isn't updated every day the others are: join its points
        connectNulls: true,
        valueFormatter: money,
      }))}
    />
  );
}
