"use client";

import { BarChart } from "@mui/x-charts/BarChart";

export type MonthlyTotals = {
  month: string;
  income: number;
  expenses: number;
};

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
        { label: "Income", data: data.map((d) => d.income), color: "#10b981" },
        {
          label: "Expenses",
          data: data.map((d) => d.expenses),
          color: "#ef4444",
        },
      ]}
    />
  );
}
