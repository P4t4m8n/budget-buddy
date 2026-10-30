// Calendar helpers. A month is "YYYY-MM" and a day is "YYYY-MM-DD", matching what the
// database stores in its DATE columns, so nothing here depends on the server's timezone.

const pad = (value: number) => String(value).padStart(2, "0");

// The month it currently is for the user, which can differ from the server's (UTC) month
export const currentMonth = (now: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}`;
};

// A month taken from user input such as ?month=2026-10; undefined when it isn't one
export const parseMonth = (value: unknown) =>
  typeof value === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : undefined;

export const addMonths = (month: string, count: number) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + count;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
};

// The first day of the month and of the next one: a transaction belongs to the month when
// start <= date < end
export const monthBounds = (month: string) => ({
  start: `${month}-01`,
  end: `${addMonths(month, 1)}-01`,
});

// The last `count` months in order, ending with `month`
export const recentMonths = (month: string, count: number) =>
  Array.from({ length: count }, (_, i) => addMonths(month, i - count + 1));
