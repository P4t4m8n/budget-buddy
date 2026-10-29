// Expected outcomes the UI can turn into friendly messages
export class NotFoundError extends Error {
  constructor(what = "Item") {
    super(`${what} not found`);
  }
}

export class DuplicateCategoryError extends Error {
  constructor() {
    super("You already have a category with this name and type");
  }
}

export class CategoryInUseError extends Error {
  constructor(
    readonly transactions: number,
    readonly budgets: number,
  ) {
    super("This category is still used by transactions or budgets");
  }
}

// The category doesn't exist, isn't the user's, or its type doesn't match the transaction's
export class CategoryMismatchError extends Error {
  constructor() {
    super("Choose one of your categories that matches the transaction type");
  }
}
