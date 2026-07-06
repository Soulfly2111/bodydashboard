export const Intensities = {
  VERY_LIGHT: "VERY_LIGHT",
  LIGHT: "LIGHT",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  VERY_HIGH: "VERY_HIGH"
} as const;

export type ActivityIntensity = keyof typeof Intensities;

export type ActivityTypeDefinition = {
  slug: string;
  name: string;
  category: "strength" | "cardio" | "outdoor" | "sport" | "mobility" | "other";
  defaultMet: number;
};

export const activityTypes: ActivityTypeDefinition[] = [
  { slug: "strength-training", name: "Krafttraining", category: "strength", defaultMet: 5.0 },
  { slug: "full-body-workout", name: "Ganzkörpertraining", category: "strength", defaultMet: 5.5 },
  { slug: "bodybuilding", name: "Bodybuilding", category: "strength", defaultMet: 5.0 },
  { slug: "cardio", name: "Cardio", category: "cardio", defaultMet: 6.0 },
  { slug: "treadmill", name: "Laufband", category: "cardio", defaultMet: 7.0 },
  { slug: "running", name: "Laufen", category: "cardio", defaultMet: 8.3 },
  { slug: "walking", name: "Walking", category: "outdoor", defaultMet: 3.5 },
  { slug: "nordic-walking", name: "Nordic Walking", category: "outdoor", defaultMet: 4.8 },
  { slug: "hiking", name: "Wandern", category: "outdoor", defaultMet: 6.0 },
  { slug: "cycling", name: "Fahrrad", category: "cardio", defaultMet: 6.8 },
  { slug: "mountainbike", name: "Mountainbike", category: "outdoor", defaultMet: 8.5 },
  { slug: "road-cycling", name: "Rennrad", category: "cardio", defaultMet: 8.0 },
  { slug: "indoor-cycling", name: "Indoor Cycling", category: "cardio", defaultMet: 7.0 },
  { slug: "elliptical", name: "Crosstrainer", category: "cardio", defaultMet: 5.0 },
  { slug: "rowing", name: "Rudern", category: "cardio", defaultMet: 7.0 },
  { slug: "swimming", name: "Schwimmen", category: "cardio", defaultMet: 6.0 },
  { slug: "yoga", name: "Yoga", category: "mobility", defaultMet: 2.5 },
  { slug: "pilates", name: "Pilates", category: "mobility", defaultMet: 3.0 },
  { slug: "football", name: "Fußball", category: "sport", defaultMet: 7.0 },
  { slug: "tennis", name: "Tennis", category: "sport", defaultMet: 7.3 },
  { slug: "badminton", name: "Badminton", category: "sport", defaultMet: 5.5 },
  { slug: "basketball", name: "Basketball", category: "sport", defaultMet: 6.5 },
  { slug: "volleyball", name: "Volleyball", category: "sport", defaultMet: 4.0 },
  { slug: "table-tennis", name: "Tischtennis", category: "sport", defaultMet: 4.0 },
  { slug: "dancing", name: "Tanzen", category: "sport", defaultMet: 5.0 },
  { slug: "martial-arts", name: "Kampfsport", category: "sport", defaultMet: 10.0 },
  { slug: "boxing", name: "Boxen", category: "sport", defaultMet: 9.0 },
  { slug: "skiing", name: "Skifahren", category: "outdoor", defaultMet: 7.0 },
  { slug: "inline-skating", name: "Inline Skaten", category: "outdoor", defaultMet: 7.5 },
  { slug: "other", name: "Sonstige", category: "other", defaultMet: 4.0 }
];

export function metForIntensity(defaultMet: number, intensity: string) {
  const multipliers: Record<string, number> = {
    VERY_LIGHT: 0.55,
    LIGHT: 0.75,
    MEDIUM: 1,
    HIGH: 1.25,
    VERY_HIGH: 1.5
  };
  return Math.round(defaultMet * (multipliers[intensity] ?? 1) * 10) / 10;
}

export function slugifyActivityName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
