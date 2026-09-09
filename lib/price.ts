type PriceRange = { min: number; max: number };

/** Read an advertised price or range, including shorthand such as $850k and $1.2m. */
export function parsePriceRange(priceText: string | null): PriceRange | null {
  if (!priceText) return null;
  const amounts = [...priceText.matchAll(/(\$|AUD\s*)?(\d[\d,]*(?:\.\d+)?)\s*(million|thousand|[mk])?(?![a-z\d])/gi)];
  const valueOf = (match: RegExpMatchArray, inheritedUnit?: string): number | null => {
    const number = Number(match[2].replace(/,/g, ""));
    const unit = (match[3] || (number < 1000 ? inheritedUnit : "") || "").toLowerCase();
    const multiplier = unit === "m" || unit === "million" ? 1_000_000 : unit === "k" || unit === "thousand" ? 1000 : 1;
    const value = Math.round(number * multiplier);
    // Avoid treating dates and other small, unlabelled numbers as asking prices.
    return Number.isFinite(value) && value > 0 && (match[1] || unit || value >= 10_000) ? value : null;
  };

  for (let index = 0; index < amounts.length; index++) {
    const first = amounts[index];
    const second = amounts[index + 1];
    if (second) {
      const between = priceText.slice(first.index! + first[0].length, second.index);
      if (/^\s*(?:[-–—]|to)\s*$/i.test(between)) {
        const min = valueOf(first, second[3]);
        const max = valueOf(second, first[3]);
        if (min !== null && max !== null) return { min: Math.min(min, max), max: Math.max(min, max) };
      }
    }
    const value = valueOf(first);
    if (value !== null) return { min: value, max: value };
  }
  return null;
}

/** Ranges match when they overlap the budget. Unknown prices match only without a budget. */
export function matchesPriceRange(priceText: string | null, minInput: string, maxInput: string): boolean {
  if (!minInput && !maxInput) return true;
  const min = minInput ? Number(minInput) : 0;
  const max = maxInput ? Number(maxInput) : Infinity;
  if (!Number.isFinite(min) || Number.isNaN(max) || min < 0 || max < min) return false;
  const range = parsePriceRange(priceText);
  return range !== null && range.max >= min && range.min <= max;
}
