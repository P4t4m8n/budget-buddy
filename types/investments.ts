import type { Investment } from "@/types/finance";

// An investment as the table shows it
export type InvestmentRow = Investment & {
  // (current value - invested) / invested, in percent
  gainPercent: number;
  // How many dated values are stored for it
  snapshotCount: number;
};

// One line of the "value over time" chart: a value per date, null where this
// investment has none
export type HistorySeries = {
  id: string;
  label: string;
  data: (number | null)[];
};

export type InvestmentHistory = {
  // Every date that has a value, oldest first
  dates: string[];
  series: HistorySeries[];
};

export type InvestmentsOverview = {
  investments: InvestmentRow[];
  // Only ILS investments are added up until currency conversion exists
  totalInvested: number;
  portfolioValue: number;
  // portfolioValue - totalInvested
  gain: number;
  history: InvestmentHistory;
};
