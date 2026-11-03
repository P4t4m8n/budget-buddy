import { Suspense } from "react";

import PageHeader from "@/components/layout/PageHeader";
import BudgetContent from "@/components/budget/BudgetContent";


interface BudgetPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function BudgetPage({ searchParams }: BudgetPageProps) {
  return (
    <>
      <PageHeader
        title="Budget"
        description="Plan your monthly budget, overall and per category"
      />
      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-xl bg-neutral-900" />
        }
      >
        <BudgetContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
