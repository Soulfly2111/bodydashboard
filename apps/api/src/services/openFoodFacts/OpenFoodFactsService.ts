export type OpenFoodFactsProduct = {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  nutriScore?: string;
  caloriesPer100g: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  salt: number;
};

type SearchParams = {
  query?: string;
  brand?: string;
  category?: string;
  barcode?: string;
  country?: string;
  language?: string;
};

const fields = [
  "code",
  "product_name",
  "product_name_de",
  "brands",
  "categories",
  "categories_tags",
  "image_front_small_url",
  "image_url",
  "nutriscore_grade",
  "nutriments"
].join(",");

export class OpenFoodFactsService {
  private baseUrl = "https://world.openfoodfacts.org";
  private userAgent = "Bodydashboard/1.0 (https://github.com/Soulfly2111/bodydashboard)";

  async search(params: SearchParams) {
    if (params.barcode) {
      const product = await this.getByBarcode(params.barcode);
      return product ? [product] : [];
    }

    const url = new URL(`${this.baseUrl}/cgi/search.pl`);
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "20");
    url.searchParams.set("fields", fields);
    url.searchParams.set("search_terms", params.query ?? "");
    if (params.brand) url.searchParams.set("tagtype_0", "brands");
    if (params.brand) url.searchParams.set("tag_contains_0", "contains");
    if (params.brand) url.searchParams.set("tag_0", params.brand);
    if (params.category) url.searchParams.set("tagtype_1", "categories");
    if (params.category) url.searchParams.set("tag_contains_1", "contains");
    if (params.category) url.searchParams.set("tag_1", params.category);
    if (params.country) url.searchParams.set("tagtype_2", "countries");
    if (params.country) url.searchParams.set("tag_contains_2", "contains");
    if (params.country) url.searchParams.set("tag_2", params.country);
    if (params.language) url.searchParams.set("lc", params.language);

    const response = await fetch(url, { headers: { "User-Agent": this.userAgent } });
    if (!response.ok) throw new Error(`Open Food Facts search failed: ${response.status}`);
    const payload = await response.json() as { products?: unknown[] };
    return (payload.products ?? []).map((product) => this.normalize(product)).filter(Boolean) as OpenFoodFactsProduct[];
  }

  async getByBarcode(barcode: string) {
    const url = new URL(`${this.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json`);
    url.searchParams.set("fields", fields);
    const response = await fetch(url, { headers: { "User-Agent": this.userAgent } });
    if (!response.ok) throw new Error(`Open Food Facts product lookup failed: ${response.status}`);
    const payload = await response.json() as { status?: number; product?: unknown };
    if (payload.status !== 1 || !payload.product) return null;
    return this.normalize(payload.product);
  }

  private normalize(raw: unknown): OpenFoodFactsProduct | null {
    const product = raw as Record<string, unknown>;
    const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
    const barcode = String(product.code ?? "");
    const name = String(product.product_name_de || product.product_name || "").trim();
    if (!barcode || !name) return null;

    return {
      id: barcode,
      barcode,
      name,
      brand: this.optional(product.brands),
      category: this.optional(product.categories),
      imageUrl: this.optional(product.image_front_small_url) ?? this.optional(product.image_url),
      nutriScore: this.optional(product.nutriscore_grade)?.toUpperCase(),
      caloriesPer100g: this.number(nutriments["energy-kcal_100g"]),
      protein: this.number(nutriments.proteins_100g),
      carbs: this.number(nutriments.carbohydrates_100g),
      fat: this.number(nutriments.fat_100g),
      sugar: this.number(nutriments.sugars_100g),
      fiber: this.number(nutriments.fiber_100g),
      salt: this.number(nutriments.salt_100g)
    };
  }

  private number(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
  }

  private optional(value: unknown) {
    const text = String(value ?? "").trim();
    return text || undefined;
  }
}
