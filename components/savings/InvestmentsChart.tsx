

import { BarChart } from "@mui/x-charts/BarChart";
import type { InvestmentRow } from "./InvestmentsTable";

export default function InvestmentsChart({ rows }: { rows: InvestmentRow[] }) {
  return (
    <BarChart
      height={320}
      xAxis={[{ scaleType: "band", data: rows.map((r) => r.name) }]}
      series={[
        {
          label: "Invested",
          data: rows.map((r) => r.amountInvested),
          color: "#6366f1",
        },
        {
          label: "Current value",
          data: rows.map((r) => r.currentValue),
          color: "#10b981",
        },
      ]}
    />
  );
}
