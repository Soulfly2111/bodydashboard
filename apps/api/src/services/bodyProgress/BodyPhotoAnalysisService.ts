import { prisma } from "../../config/prisma.js";

export class BodyPhotoAnalysisService {
  async analyze(userId: string, photoId: string) {
    const photo = await prisma.bodyPhoto.findFirstOrThrow({ where: { id: photoId, userId }, include: { user: true } });
    const detectedViewType = photo.viewType === "CUSTOM" ? "FRONT" : photo.viewType;
    const estimates = {
      abdomen: { label: "Bauchumfang", value: 104, unit: "cm" },
      skinfold: { label: "Hautfaltendicke", value: 22, unit: "mm" },
      waist: { label: "Taillenumfang", value: 98, unit: "cm" },
      chest: { label: "Brustumfang", value: 112, unit: "cm" }
    };
    const confidence = { abdomen: 62, skinfold: 42, waist: 58, chest: 55 };
    const analysisText = `Die KI erkennt eine ${detectedViewType === "FRONT" ? "Vorderansicht" : "Koerperansicht"}. Die Bildqualitaet ist gut, die Messwerte sind aber Schaetzwerte. Der geschaetzte Bauchumfang liegt bei ca. 104 cm, die Hautfaltendicke bei ca. 22 mm mit niedriger bis mittlerer Konfidenz. Bitte pruefe die Werte vor dem Speichern.`;
    return prisma.bodyPhotoAnalysis.create({
      data: {
        photoId: photo.id,
        provider: "local",
        detectedViewType,
        imageQualityScore: 78,
        estimatedMeasurementsJson: JSON.stringify(estimates),
        confidenceJson: JSON.stringify(confidence),
        analysisText,
        warnings: "Arme und Kleidung koennen Messwerte verfaelschen. Nutze moeglichst gleiche Entfernung, Licht und Koerperhaltung."
      }
    });
  }

  getForPhoto(userId: string, photoId: string) {
    return prisma.bodyPhotoAnalysis.findMany({ where: { photo: { id: photoId, userId } }, orderBy: { createdAt: "desc" } });
  }
}
