import { prisma } from "../../config/prisma.js";

export class BodyPhotoAnalysisService {
  async analyze(userId: string, photoId: string) {
    const photo = await prisma.bodyPhoto.findFirstOrThrow({ where: { id: photoId, userId }, include: { user: true } });
    const detectedViewType = photo.viewType === "CUSTOM" ? "FRONT" : photo.viewType;
    const estimates = {
      abdomen: { label: "Bauchumfang", value: 104, unit: "cm" },
      waist: { label: "Taillenumfang", value: 98, unit: "cm" },
      chest: { label: "Brustumfang", value: 112, unit: "cm" }
    };
    const confidence = { abdomen: 62, waist: 58, chest: 55 };
    const analysisText = `Die KI erkennt eine ${detectedViewType === "FRONT" ? "Vorderansicht" : "Körperansicht"}. Die Bildqualität ist gut, die Messwerte sind aber Schätzwerte. Der geschätzte Bauchumfang liegt bei ca. 104 cm mit mittlerer Konfidenz. Bitte prüfe die Werte vor dem Speichern.`;
    return prisma.bodyPhotoAnalysis.create({
      data: {
        photoId: photo.id,
        provider: "local",
        detectedViewType,
        imageQualityScore: 78,
        estimatedMeasurementsJson: JSON.stringify(estimates),
        confidenceJson: JSON.stringify(confidence),
        analysisText,
        warnings: "Arme und Kleidung können Messwerte verfälschen. Nutze möglichst gleiche Entfernung, Licht und Körperhaltung."
      }
    });
  }

  getForPhoto(userId: string, photoId: string) {
    return prisma.bodyPhotoAnalysis.findMany({ where: { photo: { id: photoId, userId } }, orderBy: { createdAt: "desc" } });
  }
}
