import { Suspense } from "react";
import CategoryDialog from "@/components/categories/CategoryDialog";
import CategoryLists from "@/components/categories/CategoryLists";
import PageHeader from "@/components/layout/PageHeader";

export default function CategoriesPage() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Categories"
          description="Organize your income and spending"
        />
        <CategoryDialog />
      </div>
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-neutral-900" />}
      >
        <CategoryLists />
      </Suspense>
    </>
  );
}
