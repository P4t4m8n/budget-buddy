"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { formatCurrency } from "@/lib/format";
import type { InvestmentRow } from "@/types/investments";

const money = (value: number | null) =>
  value === null ? "" : formatCurrency(value);

export default function InvestmentsChart({ rows }: { rows: InvestmentRow[] }) {
  return (
    <BarChart
      height={320}
      xAxis={[{ scaleType: "band", data: rows.map((r) => r.name) }]}
      yAxis={[{ width: 64 }]}
      series={[
        {
          label: "Invested",
          data: rows.map((r) => r.amountInvested),
          color: "#6366f1",
          valueFormatter: money,
        },
        {
          label: "Current value",
          data: rows.map((r) => r.currentValue),
          color: "#10b981",
          valueFormatter: money,
        },
      ]}
    />
  );
}
