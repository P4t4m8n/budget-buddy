"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { formatCurrency } from "@/lib/format";
import type { MonthlyTotals } from "@/types/dashboard";

const money = (value: number | null) =>
  value === null ? "" : formatCurrency(value);

export default function MonthlyOverviewChart({
  data,
}: {
  data: MonthlyTotals[];
}) {
  return (
    <BarChart
      height={280}
      xAxis={[{ scaleType: "band", data: data.map((d) => d.month) }]}
      series={[
        {
          label: "Income",
          data: data.map((d) => d.income),
          color: "#10b981",
          valueFormatter: money,
        },
        {
          label: "Expenses",
          data: data.map((d) => d.expenses),
          color: "#ef4444",
          valueFormatter: money,
        },
      ]}
    />
  );
}
