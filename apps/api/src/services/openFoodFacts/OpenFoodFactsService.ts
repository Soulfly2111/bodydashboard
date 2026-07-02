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
  private countryHosts: Record<string, string> = {
    de: "https://de.openfoodfacts.org",
    deutschland: "https://de.openfoodfacts.org",
    germany: "https://de.openfoodfacts.org",
    at: "https://at.openfoodfacts.org",
    austria: "https://at.openfoodfacts.org",
    oesterreich: "https://at.openfoodfacts.org",
    österreich: "https://at.openfoodfacts.org",
    ch: "https://ch.openfoodfacts.org",
    schweiz: "https://ch.openfoodfacts.org",
    switzerland: "https://ch.openfoodfacts.org"
  };

  async search(params: SearchParams) {
    if (params.barcode) {
      const product = await this.getByBarcode(params.barcode);
      return product ? [product] : [];
    }

    const hosts = [...new Set([this.countryHost(params.country), this.baseUrl].filter(Boolean) as string[])];
    let lastError: unknown;

    for (const host of hosts) {
      try {
        const products = await this.searchHost(host, params);
        if (products.length > 0) return products;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError && hosts.length === 1) throw lastError;
    return [];
  }

  private async searchHost(host: string, params: SearchParams) {
    const url = new URL(`${host}/cgi/search.pl`);
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "20");
    url.searchParams.set("fields", fields);
    url.searchParams.set("search_terms", params.query ?? "");
    if (params.language) url.searchParams.set("lc", params.language);

    let tagIndex = 0;
    if (params.brand) {
      url.searchParams.set(`tagtype_${tagIndex}`, "brands");
      url.searchParams.set(`tag_contains_${tagIndex}`, "contains");
      url.searchParams.set(`tag_${tagIndex}`, params.brand);
      tagIndex += 1;
    }
    if (params.category) {
      url.searchParams.set(`tagtype_${tagIndex}`, "categories");
      url.searchParams.set(`tag_contains_${tagIndex}`, "contains");
      url.searchParams.set(`tag_${tagIndex}`, params.category);
    }

    const response = await fetch(url, { headers: { "User-Agent": this.userAgent } });
    if (!response.ok) throw new Error(`Open Food Facts search failed: ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) throw new Error("Open Food Facts search did not return JSON");
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

  private countryHost(country?: string) {
    const key = String(country ?? "").trim().toLowerCase();
    return key ? this.countryHosts[key] : undefined;
  }
}
