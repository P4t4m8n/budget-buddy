"use client";

import { PieChart } from "@mui/x-charts/PieChart";

export type SpendingSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export default function SpendingByCategoryChart({
  data,
}: {
  data: SpendingSlice[];
}) {
  return (
    <PieChart
      height={280}
      series={[{ data, innerRadius: 60, paddingAngle: 2 }]}
    />
  );
}
