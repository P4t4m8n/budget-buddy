import type { Transaction, TransactionType } from "@/types/finance";

const tx = (
  id: string,
  date: string,
  type: TransactionType,
  categoryId: string,
  description: string,
  amount: number,
): Transaction => ({
  id,
  date,
  type,
  categoryId,
  description,
  amount,
  currency: "ILS",
  note: null,
});

export const transactions: Transaction[] = [
  // August 2026
  tx("t-001", "2026-08-01", "INCOME", "cat-salary", "Monthly salary", 7200),
  tx("t-002", "2026-08-02", "EXPENSE", "cat-rent", "Apartment rent", 2400),
  tx("t-003", "2026-08-06", "EXPENSE", "cat-groceries", "Supermarket", 410),
  tx("t-004", "2026-08-10", "EXPENSE", "cat-utilities", "Electricity bill", 180),
  tx("t-005", "2026-08-12", "EXPENSE", "cat-transport", "Bus pass", 120),
  tx("t-006", "2026-08-15", "EXPENSE", "cat-dining", "Dinner with friends", 145),
  tx("t-007", "2026-08-18", "INCOME", "cat-freelance", "Website project", 900),
  tx("t-008", "2026-08-22", "EXPENSE", "cat-entertainment", "Cinema tickets", 60),
  tx("t-009", "2026-08-25", "EXPENSE", "cat-shopping", "New sneakers", 320),

  // September 2026
  tx("t-010", "2026-09-01", "INCOME", "cat-salary", "Monthly salary", 7200),
  tx("t-011", "2026-09-02", "EXPENSE", "cat-rent", "Apartment rent", 2400),
  tx("t-012", "2026-09-05", "EXPENSE", "cat-groceries", "Supermarket", 465),
  tx("t-013", "2026-09-09", "EXPENSE", "cat-utilities", "Water & internet", 210),
  tx("t-014", "2026-09-11", "EXPENSE", "cat-transport", "Fuel", 190),
  tx("t-015", "2026-09-14", "EXPENSE", "cat-health", "Dentist", 350),
  tx("t-016", "2026-09-19", "EXPENSE", "cat-dining", "Restaurant", 98),
  tx("t-017", "2026-09-21", "INCOME", "cat-other-income", "Sold old laptop", 450),
  tx("t-018", "2026-09-23", "EXPENSE", "cat-entertainment", "Streaming subscriptions", 55),
  tx("t-019", "2026-09-27", "EXPENSE", "cat-groceries", "Supermarket", 380),

  // October 2026
  tx("t-020", "2026-10-01", "INCOME", "cat-salary", "Monthly salary", 7200),
  tx("t-021", "2026-10-02", "EXPENSE", "cat-rent", "Apartment rent", 2400),
  tx("t-022", "2026-10-04", "EXPENSE", "cat-groceries", "Supermarket", 430),
  tx("t-023", "2026-10-08", "EXPENSE", "cat-utilities", "Electricity bill", 195),
  tx("t-024", "2026-10-10", "EXPENSE", "cat-transport", "Train tickets", 85),
  tx("t-025", "2026-10-12", "INCOME", "cat-freelance", "Logo design", 1100),
  tx("t-026", "2026-10-15", "EXPENSE", "cat-health", "Pharmacy", 70),
  tx("t-027", "2026-10-18", "EXPENSE", "cat-dining", "Birthday dinner", 230),
  tx("t-028", "2026-10-20", "EXPENSE", "cat-entertainment", "Concert tickets", 160),
  tx("t-029", "2026-10-24", "EXPENSE", "cat-shopping", "Winter jacket", 280),
  tx("t-030", "2026-10-27", "EXPENSE", "cat-groceries", "Supermarket", 395),
];
