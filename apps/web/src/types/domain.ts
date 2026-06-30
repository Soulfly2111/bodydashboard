export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  salt?: number;
};

export type Goal = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  weightKg?: number | null;
};

export type Food = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  barcode?: string;
  source?: string;
  externalId?: string;
  importedAt?: string;
  lastSyncedAt?: string;
  sourcePayload?: string;
  caloriesPer100g: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
};

export type DayStats = {
  totals: MacroTotals;
  waterMl: number;
  weight?: { weightKg: number };
  bmi: number | null;
  goal: Goal;
};

export type WeekDay = MacroTotals & { date: string };

export type AiRecognizedMealItem = {
  id?: string;
  foodId?: string;
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
  source?: string;
};

export type AiMealAnalysis = {
  id: string;
  date: string;
  mealType: string;
  customMealTag?: string;
  provider: string;
  status: string;
  mode: string;
  confidence: number;
  imageFileName?: string;
  analyzedAt: string;
  totalsJson?: string;
  items: AiRecognizedMealItem[];
};

export type AiRecognitionSettings = {
  mode: "AUTO" | "REVIEW_REQUIRED" | "ALWAYS_EDIT";
  minConfidence: number;
  storeImages: boolean;
  deleteAfterAnalysis: boolean;
  linkImageToMeal: boolean;
  provider: "local" | "openai" | "gemini" | "anthropic" | "azure_openai" | "ollama";
};
