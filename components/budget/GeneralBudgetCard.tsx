// ---Components---
import { barColor } from "./bar-color";
import DeleteGeneralBudgetButton from "./DeleteGeneralBudgetButton";
import GeneralBudgetDialog from "./GeneralBudgetDialog";

// ---Lib---
import { BASE_CURRENCY } from "@/lib/constants";
import { formatCurrency, formatMonth } from "@/lib/format";

// ---Types---
import type { GeneralBudget } from "@/types/budget";
import type { Currency } from "@/types/finance";

// The Hebrew currency format carries right-to-left marks; isolating each amount keeps
// the sentences around it from being reordered
const Amount = ({ value, currency }: { value: number; currency: Currency }) => (
  <bdi dir="ltr">{formatCurrency(value, currency)}</bdi>
);

interface GeneralBudgetCardProps {
  general: GeneralBudget | null;
  month: string;
  totalSpent: number;
  allocated: number;
}
// The month's general budget: everything spent counts against it, next to the category
// budgets below, which are tracked on their own
export default function GeneralBudgetCard({
  general,
  month,
  totalSpent,
  allocated,
}: GeneralBudgetCardProps) {
  const ratio = general ? totalSpent / general.limit : 0;
  const over = general !== null && general.remaining < 0;
  // Category budgets can promise more than the month has
  const overAllocated = general !== null && allocated > general.limit;

  return (
    <section
      aria-labelledby="monthly-budget-heading"
      className="mb-8 rounded-xl border border-white/10 bg-neutral-900 p-5"
    >
      <MonthlyBudgetCard general={general} month={month} />

      {general === null ? (
        <NoMonthlyBudget month={month} totalSpent={totalSpent} />
      ) : (
        <>
          <MonthlyLimit general={general} totalSpent={totalSpent} over={over} />

          <MonthlyBudgetUsed
            general={general}
            totalSpent={totalSpent}
            over={over}
            ratio={ratio}
          />

          <MonthlyCatagory
            general={general}
            allocated={allocated}
            overAllocated={overAllocated}
          />
        </>
      )}
    </section>
  );
}

interface MonthlyBudgetCardProps {
  general: GeneralBudget | null;
  month: string;
}
const MonthlyBudgetCard = ({ general, month }: MonthlyBudgetCardProps) => {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id="monthly-budget-heading" className="font-semibold">
        Monthly budget
      </h2>
      <div className="flex items-center gap-1">
        <GeneralBudgetDialog general={general} month={month} />
        {general && (
          <DeleteGeneralBudgetButton general={general} month={month} />
        )}
      </div>
    </div>
  );
};

interface NoMonthlyBudgetProps {
  month: string;
  totalSpent: number;
}
const NoMonthlyBudget = ({ month, totalSpent }: NoMonthlyBudgetProps) => {
  return (
    <p className="mt-3 text-sm text-neutral-400">
      No monthly budget for {formatMonth(month)} yet. Set one limit for all your
      spending
      {totalSpent > 0 && (
        <>
          {" "}
          (<Amount value={totalSpent} currency={BASE_CURRENCY} /> spent so far)
        </>
      )}
      .
    </p>
  );
};

interface MonthlyLimitProps {
  general: GeneralBudget;
  totalSpent: number;
  over: boolean;
}
const MonthlyLimit = ({ general, totalSpent, over }: MonthlyLimitProps) => {
  return (
    <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <dt className="text-sm text-neutral-400">Monthly limit</dt>
        <dd className="mt-1 text-xl font-bold">
          <Amount value={general.limit} currency={general.currency} />
        </dd>
      </div>
      <div>
        <dt className="text-sm text-neutral-400">Spent this month</dt>
        <dd className={`mt-1 text-xl font-bold ${over ? "text-red-400" : ""}`}>
          <Amount value={totalSpent} currency={general.currency} />
        </dd>
      </div>
      <div>
        <dt className="text-sm text-neutral-400">
          {over ? "Over by" : "Left to spend"}
        </dt>
        <dd
          className={`mt-1 text-xl font-bold ${over ? "text-red-400" : "text-emerald-400"}`}
        >
          <Amount
            value={Math.abs(general.remaining)}
            currency={general.currency}
          />
        </dd>
      </div>
    </dl>
  );
};

interface MonthlyBudgetUsedProps {
  general: GeneralBudget;
  totalSpent: number;
  over: boolean;
  ratio: number;
}
const MonthlyBudgetUsed = ({
  general,
  totalSpent,
  over,
  ratio,
}: MonthlyBudgetUsedProps) => {
  return (
    <>
      <div
        role="progressbar"
        aria-label="Monthly budget used"
        aria-valuemin={0}
        aria-valuemax={general.limit}
        aria-valuenow={Math.min(totalSpent, general.limit)}
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={`h-full rounded-full ${barColor(ratio)}`}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>
      {over && (
        <p className="mt-2 text-sm text-red-400">
          You are over your monthly budget.
        </p>
      )}
    </>
  );
};

interface MonthlyCatagoryProps {
  general: GeneralBudget;
  allocated: number;
  overAllocated: boolean;
}
const MonthlyCatagory = ({
  general,
  allocated,
  overAllocated,
}: MonthlyCatagoryProps) => {
  return (
    <>
      <p className="mt-4 text-sm text-neutral-400">
        Category budgets:{" "}
        <Amount value={allocated} currency={general.currency} /> of{" "}
        <Amount value={general.limit} currency={general.currency} />
      </p>
      {overAllocated && (
        <p className="mt-1 text-sm text-amber-400">
          Your category budgets add up to more than your monthly budget.
        </p>
      )}
    </>
  );
};
