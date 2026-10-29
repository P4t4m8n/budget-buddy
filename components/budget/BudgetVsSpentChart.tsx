"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import type { BudgetRow } from "./BudgetProgressList";

export default function BudgetVsSpentChart({ rows }: { rows: BudgetRow[] }) {
  return (
    <BarChart
      height={320}
      xAxis={[{ scaleType: "band", data: rows.map((r) => r.name) }]}
      series={[
        { label: "Budget", data: rows.map((r) => r.limit), color: "#6366f1" },
        { label: "Spent", data: rows.map((r) => r.spent), color: "#f59e0b" },
      ]}
    />
  );
}
