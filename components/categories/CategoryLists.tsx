import { getCategories } from "@/lib/data/categories";
import { transactionTypeLabels } from "@/lib/labels";
import type { Category, TransactionType } from "@/types/finance";
import CategoryDialog from "./CategoryDialog";
import DeleteCategoryButton from "./DeleteCategoryButton";

const sections: { type: TransactionType; title: string }[] = [
  { type: "INCOME", title: "Income" },
  { type: "EXPENSE", title: "Expenses" },
];

export default async function CategoryLists() {
  const categories = await getCategories();

  return (
    <div className="mt-2 flex flex-col gap-6">
      {categories.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-neutral-400">
          No categories yet. Add at least one income and one expense category
          before you record transactions.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {sections.map(({ type, title }) => (
          <CategorySection
            key={type}
            title={title}
            type={type}
            categories={categories.filter((c) => c.type === type)}
          />
        ))}
      </div>
    </div>
  );
}

function CategorySection({
  title,
  type,
  categories,
}: {
  title: string;
  type: TransactionType;
  categories: Category[];
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-white/10 bg-neutral-900 p-5"
    >
      <h2 className="mb-2 font-semibold">{title}</h2>
      {categories.length === 0 ? (
        <p className="py-3 text-sm text-neutral-500">
          No {transactionTypeLabels[type].toLowerCase()} categories yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/10">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate text-sm font-medium">{category.name}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <CategoryDialog category={category} />
                <DeleteCategoryButton category={category} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
