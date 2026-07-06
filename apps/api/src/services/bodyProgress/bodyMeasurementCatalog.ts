export const bodyMeasurementTypes = [
  { slug: "abdomen", name: "Bauchumfang", sortOrder: 10 },
  { slug: "chest", name: "Brustumfang", sortOrder: 20 },
  { slug: "waist", name: "Taillenumfang", sortOrder: 30 },
  { slug: "hip", name: "Hüftumfang", sortOrder: 40 },
  { slug: "thigh-left", name: "Oberschenkel links", sortOrder: 50 },
  { slug: "thigh-right", name: "Oberschenkel rechts", sortOrder: 60 },
  { slug: "upper-arm-left", name: "Oberarm links", sortOrder: 70 },
  { slug: "upper-arm-right", name: "Oberarm rechts", sortOrder: 80 },
  { slug: "forearm-left", name: "Unterarm links", sortOrder: 90 },
  { slug: "forearm-right", name: "Unterarm rechts", sortOrder: 100 },
  { slug: "neck", name: "Halsumfang", sortOrder: 110 },
  { slug: "shoulders", name: "Schulterumfang", sortOrder: 120 },
  { slug: "calf-left", name: "Wade links", sortOrder: 130 },
  { slug: "calf-right", name: "Wade rechts", sortOrder: 140 }
];

export const bodyViewTypes = ["FRONT", "BACK", "LEFT", "RIGHT", "CUSTOM"] as const;

export function slugifyMeasurement(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
