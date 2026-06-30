export type AiMealMode = "AUTO" | "REVIEW_REQUIRED" | "ALWAYS_EDIT";
export type AiProviderId = "local" | "openai" | "gemini" | "anthropic" | "azure_openai" | "ollama";

export type UploadedImageInput = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

export type StoredImage = {
  fileName: string;
  mimeType: string;
  sha256: string;
  path?: string;
  bytes: number;
};

export type RecognizedFoodDraft = {
  name: string;
  category?: string;
  amount: number;
  weightGrams: number;
  servingName?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
  confidence: number;
  foodId?: string;
  source?: string;
};

export type AiRecognitionRequest = {
  images: StoredImage[];
  provider: AiProviderId;
  locale: string;
};

export type AiRecognitionResult = {
  provider: AiProviderId;
  confidence: number;
  items: RecognizedFoodDraft[];
  rawResult?: unknown;
};

export interface VisionProvider {
  id: AiProviderId;
  analyze(request: AiRecognitionRequest): Promise<AiRecognitionResult>;
}

export interface ImageUploadService {
  accept(images: UploadedImageInput[], options: { storeImages: boolean; deleteAfterAnalysis: boolean; userId: string }): Promise<StoredImage[]>;
}

export interface AIRecognitionService {
  analyze(request: AiRecognitionRequest): Promise<AiRecognitionResult>;
}

export interface FoodMatchingService {
  match(userId: string, item: RecognizedFoodDraft): Promise<RecognizedFoodDraft>;
}

export interface NutritionEstimationService {
  recalculate(items: RecognizedFoodDraft[]): { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; salt: number };
}

export interface MealCreationService {
  createFromAnalysis(input: { userId: string; analysisId: string; date: Date; mealType: string; customMealTag?: string; items: RecognizedFoodDraft[]; saveUnknownFoods: boolean }): Promise<{ mealId: string }>;
}
