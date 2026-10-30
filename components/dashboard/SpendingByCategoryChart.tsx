"use client";

import { PieChart } from "@mui/x-charts/PieChart";
import { formatCurrency } from "@/lib/format";
import type { SpendingSlice } from "@/types/dashboard";

export default function SpendingByCategoryChart({
  data,
}: {
  data: SpendingSlice[];
}) {
  return (
    <PieChart
      height={280}
      series={[
        {
          data,
          innerRadius: 60,
          paddingAngle: 2,
          valueFormatter: ({ value }) => formatCurrency(value),
        },
      ]}
    />
  );
}
