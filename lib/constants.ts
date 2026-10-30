import type { Currency } from "@/types/finance";

// Hard-coded until the app has real dates/user settings
export const CURRENT_MONTH = "2026-10";

// Totals and summaries are shown in this currency
export const BASE_CURRENCY: Currency = "ILS";

// "This month" starts and ends in this timezone, whatever timezone the server runs in
export const APP_TIME_ZONE = "Asia/Jerusalem";
