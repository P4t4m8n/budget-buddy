import type { Transaction } from "@/types/finance";

export const transactions: Transaction[] = [
  // August 2026
  { id: "t-001", description: "Monthly salary", amount: 7200, currency: "ILS", type: "income", categoryId: "cat-salary", date: "2026-08-01" },
  { id: "t-002", description: "Apartment rent", amount: 2400, currency: "ILS", type: "expense", categoryId: "cat-rent", date: "2026-08-02" },
  { id: "t-003", description: "Supermarket", amount: 410, currency: "ILS", type: "expense", categoryId: "cat-groceries", date: "2026-08-06" },
  { id: "t-004", description: "Electricity bill", amount: 180, currency: "ILS", type: "expense", categoryId: "cat-utilities", date: "2026-08-10" },
  { id: "t-005", description: "Bus pass", amount: 120, currency: "ILS", type: "expense", categoryId: "cat-transport", date: "2026-08-12" },
  { id: "t-006", description: "Dinner with friends", amount: 145, currency: "ILS", type: "expense", categoryId: "cat-dining", date: "2026-08-15" },
  { id: "t-007", description: "Website project", amount: 900, currency: "ILS", type: "income", categoryId: "cat-freelance", date: "2026-08-18" },
  { id: "t-008", description: "Cinema tickets", amount: 60, currency: "ILS", type: "expense", categoryId: "cat-entertainment", date: "2026-08-22" },
  { id: "t-009", description: "New sneakers", amount: 320, currency: "ILS", type: "expense", categoryId: "cat-shopping", date: "2026-08-25" },

  // September 2026
  { id: "t-010", description: "Monthly salary", amount: 7200, currency: "ILS", type: "income", categoryId: "cat-salary", date: "2026-09-01" },
  { id: "t-011", description: "Apartment rent", amount: 2400, currency: "ILS", type: "expense", categoryId: "cat-rent", date: "2026-09-02" },
  { id: "t-012", description: "Supermarket", amount: 465, currency: "ILS", type: "expense", categoryId: "cat-groceries", date: "2026-09-05" },
  { id: "t-013", description: "Water & internet", amount: 210, currency: "ILS", type: "expense", categoryId: "cat-utilities", date: "2026-09-09" },
  { id: "t-014", description: "Fuel", amount: 190, currency: "ILS", type: "expense", categoryId: "cat-transport", date: "2026-09-11" },
  { id: "t-015", description: "Dentist", amount: 350, currency: "ILS", type: "expense", categoryId: "cat-health", date: "2026-09-14" },
  { id: "t-016", description: "Restaurant", amount: 98, currency: "ILS", type: "expense", categoryId: "cat-dining", date: "2026-09-19" },
  { id: "t-017", description: "Sold old laptop", amount: 450, currency: "ILS", type: "income", categoryId: "cat-other-income", date: "2026-09-21" },
  { id: "t-018", description: "Streaming subscriptions", amount: 55, currency: "ILS", type: "expense", categoryId: "cat-entertainment", date: "2026-09-23" },
  { id: "t-019", description: "Supermarket", amount: 380, currency: "ILS", type: "expense", categoryId: "cat-groceries", date: "2026-09-27" },

  // October 2026
  { id: "t-020", description: "Monthly salary", amount: 7200, currency: "ILS", type: "income", categoryId: "cat-salary", date: "2026-10-01" },
  { id: "t-021", description: "Apartment rent", amount: 2400, currency: "ILS", type: "expense", categoryId: "cat-rent", date: "2026-10-02" },
  { id: "t-022", description: "Supermarket", amount: 430, currency: "ILS", type: "expense", categoryId: "cat-groceries", date: "2026-10-04" },
  { id: "t-023", description: "Electricity bill", amount: 195, currency: "ILS", type: "expense", categoryId: "cat-utilities", date: "2026-10-08" },
  { id: "t-024", description: "Train tickets", amount: 85, currency: "ILS", type: "expense", categoryId: "cat-transport", date: "2026-10-10" },
  { id: "t-025", description: "Logo design", amount: 1100, currency: "ILS", type: "income", categoryId: "cat-freelance", date: "2026-10-12" },
  { id: "t-026", description: "Pharmacy", amount: 70, currency: "ILS", type: "expense", categoryId: "cat-health", date: "2026-10-15" },
  { id: "t-027", description: "Birthday dinner", amount: 230, currency: "ILS", type: "expense", categoryId: "cat-dining", date: "2026-10-18" },
  { id: "t-028", description: "Concert tickets", amount: 160, currency: "ILS", type: "expense", categoryId: "cat-entertainment", date: "2026-10-20" },
  { id: "t-029", description: "Winter jacket", amount: 280, currency: "ILS", type: "expense", categoryId: "cat-shopping", date: "2026-10-24" },
  { id: "t-030", description: "Supermarket", amount: 395, currency: "ILS", type: "expense", categoryId: "cat-groceries", date: "2026-10-27" },
];
