"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { formatCurrency } from "@/lib/format";

type ChartRow = { name: string; limit: number; spent: number };

const money = (value: number | null) =>
  value === null ? "" : formatCurrency(value);

// Only for categories that have a budget
export default function BudgetVsSpentChart({ rows }: { rows: ChartRow[] }) {
  return (
    <BarChart
      height={320}
      xAxis={[{ scaleType: "band", data: rows.map((r) => r.name) }]}
      series={[
        {
          label: "Budget",
          data: rows.map((r) => r.limit),
          color: "#6366f1",
          valueFormatter: money,
        },
        {
          label: "Spent",
          data: rows.map((r) => r.spent),
          color: "#f59e0b",
          valueFormatter: money,
        },
      ]}
    />
  );
}
