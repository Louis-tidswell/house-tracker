export type ImportedProperty = {
  sourceUrl: string;
  source: "realestate.com.au" | "domain.com.au";
  listingId?: string | null;

  title?: string | null;
  address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;

  priceText?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  carSpaces?: number | null;
  landSizeText?: string | null;

  description?: string | null;
  imageUrl?: string | null;

  status: "active" | "under_offer" | "sold" | "removed" | "needs_review";

  raw?: {
    ogTitle?: string | null;
    ogDescription?: string | null;
    jsonLd?: unknown[];
    nextData?: unknown;
  };
};
