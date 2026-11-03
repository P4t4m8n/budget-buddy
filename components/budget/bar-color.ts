// Green while there is room, amber when close to the limit, red once it is exceeded
export const barColor = (ratio: number) =>
  ratio > 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-emerald-500";
