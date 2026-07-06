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
  weight?: { weightKg?: number | null; bodyFatPercent?: number | null; muscleMassKg?: number | null };
  bmi: number | null;
  goal: Goal;
  activities?: { count: number; calories: number; durationMinutes: number };
  energy?: {
    consumedCalories: number;
    basalMetabolicRate: number;
    activityCalories: number;
    trainingCalories: number;
    totalExpenditure: number;
    netCalories: number;
    calorieBalance: number;
    surplus: number;
    deficit: number;
  };
};

export type WeekDay = MacroTotals & {
  date: string;
  waterMl?: number;
  activityCalories?: number;
  trainingMinutes?: number;
  activityCount?: number;
  weightKg?: number | null;
  bodyFatPercent?: number | null;
  muscleMassKg?: number | null;
};

export type ActivityEntry = {
  id: string;
  typeName: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes: number;
  intensity: "VERY_LIGHT" | "LIGHT" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  distanceKm?: number | null;
  averageSpeedKmh?: number | null;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  calories: number;
  caloriesOverride: boolean;
  notes?: string | null;
  steps?: number | null;
  elevationGainM?: number | null;
  powerWatts?: number | null;
  cadence?: number | null;
  pace?: string | null;
  source: string;
  muscleGroupsJson?: string | null;
  exercisesCount?: number | null;
  setsCount?: number | null;
  repsCount?: number | null;
  trainingVolume?: number | null;
};

export type ActivityTypeOption = {
  id?: string;
  slug: string;
  name: string;
  category: string;
  defaultMet: number;
};

export type BodyPhoto = {
  id: string;
  date: string;
  viewType: "FRONT" | "BACK" | "LEFT" | "RIGHT" | "CUSTOM";
  imageUrl: string;
  thumbnailUrl?: string | null;
  notes?: string | null;
  trainingPhase?: string | null;
  dietPhase?: string | null;
  referenceObject?: string | null;
};

export type BodyMeasurement = {
  id: string;
  date: string;
  measurementType: string;
  value: number;
  unit: string;
  source: string;
  confidence?: number | null;
  confirmedByUser: boolean;
  notes?: string | null;
};

export type BodyProgressStatistics = {
  latestPhoto: BodyPhoto | null;
  latestMeasurements: Record<string, BodyMeasurement>;
  changes: Record<string, number>;
  ratios: { waistToHip: number | null; waistToHeight: number | null };
  series: Record<string, Array<{ date: string; value: number }>>;
  photoCount: number;
};

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
