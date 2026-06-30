import type { AiProviderId, AiRecognitionRequest, AiRecognitionResult, VisionProvider } from "./types.js";

const foodHints = [
  { match: ["pizza"], name: "Pizza", category: "Fast Food", weightGrams: 320, calories: 850, protein: 36, carbs: 92, fat: 34, fiber: 5, sugar: 9, salt: 3.8, confidence: 74 },
  { match: ["salat", "salad"], name: "Gemischter Salat", category: "Gemüse", weightGrams: 260, calories: 210, protein: 8, carbs: 18, fat: 12, fiber: 7, sugar: 8, salt: 1.1, confidence: 72 },
  { match: ["reis", "rice"], name: "Reis gekocht", category: "Beilage", weightGrams: 180, calories: 234, protein: 4.9, carbs: 50.4, fat: 0.5, fiber: 1.8, sugar: 0.2, salt: 0.02, confidence: 76 },
  { match: ["nudel", "pasta"], name: "Pasta gekocht", category: "Beilage", weightGrams: 220, calories: 330, protein: 12, carbs: 66, fat: 2.4, fiber: 4, sugar: 2, salt: 0.1, confidence: 73 },
  { match: ["banane", "banana"], name: "Banane", category: "Obst", weightGrams: 120, calories: 107, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14.4, salt: 0.01, confidence: 78 },
  { match: ["burger"], name: "Burger", category: "Fast Food", weightGrams: 280, calories: 720, protein: 34, carbs: 62, fat: 38, fiber: 4, sugar: 10, salt: 3.1, confidence: 70 },
  { match: ["soja", "tofu"], name: "Tofu", category: "Protein", weightGrams: 160, calories: 230, protein: 24, carbs: 4, fat: 14, fiber: 2, sugar: 1, salt: 0.4, confidence: 69 }
];

export class LocalVisionProvider implements VisionProvider {
  id: AiProviderId = "local";

  async analyze(request: AiRecognitionRequest): Promise<AiRecognitionResult> {
    const haystack = request.images.map((image) => image.fileName.toLowerCase()).join(" ");
    const matched = foodHints.filter((hint) => hint.match.some((word) => haystack.includes(word)));
    const items = matched.length ? matched : [
      { name: "Gemischte Mahlzeit", category: "Mahlzeit", amount: 1, weightGrams: 350, servingName: "Portion", calories: 620, protein: 28, carbs: 62, fat: 26, fiber: 7, sugar: 10, salt: 2.1, confidence: 55 },
      { name: "Beilage", category: "Beilage", amount: 1, weightGrams: 160, servingName: "Portion", calories: 210, protein: 5, carbs: 42, fat: 2, fiber: 3, sugar: 2, salt: 0.3, confidence: 45 }
    ];

    const normalized = items.map((item) => ({ ...item, amount: "amount" in item ? item.amount : 1, servingName: "servingName" in item ? item.servingName : "Portion", source: "ai_estimate" }));
    return {
      provider: this.id,
      confidence: Math.round(normalized.reduce((sum, item) => sum + item.confidence, 0) / normalized.length),
      items: normalized,
      rawResult: { provider: this.id, note: "Local draft provider. Configure a cloud or Ollama adapter for real image recognition." }
    };
  }
}

class UnconfiguredVisionProvider implements VisionProvider {
  constructor(public id: AiProviderId) {}

  async analyze(): Promise<AiRecognitionResult> {
    throw new Error(`${this.id} vision provider is not configured yet`);
  }
}

export class ProviderRegistryRecognitionService {
  private providers = new Map<AiProviderId, VisionProvider>([
    ["local", new LocalVisionProvider()],
    ["openai", new UnconfiguredVisionProvider("openai")],
    ["gemini", new UnconfiguredVisionProvider("gemini")],
    ["anthropic", new UnconfiguredVisionProvider("anthropic")],
    ["azure_openai", new UnconfiguredVisionProvider("azure_openai")],
    ["ollama", new UnconfiguredVisionProvider("ollama")]
  ]);

  async analyze(request: AiRecognitionRequest) {
    const provider = this.providers.get(request.provider) ?? this.providers.get("local")!;
    return provider.analyze(request);
  }
}
