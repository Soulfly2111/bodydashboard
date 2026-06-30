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
