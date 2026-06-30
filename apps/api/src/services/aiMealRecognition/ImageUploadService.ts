import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { ImageUploadService as ImageUploadServiceContract, StoredImage, UploadedImageInput } from "./types.js";

export class LocalImageUploadService implements ImageUploadServiceContract {
  async accept(images: UploadedImageInput[], options: { storeImages: boolean; deleteAfterAnalysis: boolean; userId: string }): Promise<StoredImage[]> {
    const safeUserId = options.userId.replace(/[^a-zA-Z0-9_-]/g, "");
    const uploadRoot = path.resolve(process.cwd(), "uploads", "ai-meals", safeUserId);
    if (options.storeImages && !options.deleteAfterAnalysis) {
      await mkdir(uploadRoot, { recursive: true });
    }

    return Promise.all(images.map(async (image, index) => {
      const buffer = this.decodeDataUrl(image.dataUrl);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const extension = this.extensionFor(image.mimeType);
      const fileName = image.fileName || `meal-${index + 1}.${extension}`;
      let storedPath: string | undefined;

      if (options.storeImages && !options.deleteAfterAnalysis) {
        storedPath = path.join(uploadRoot, `${Date.now()}-${index + 1}-${sha256.slice(0, 12)}.${extension}`);
        await writeFile(storedPath, buffer);
      }

      return {
        fileName,
        mimeType: image.mimeType,
        sha256,
        path: storedPath,
        bytes: buffer.byteLength
      };
    }));
  }

  private decodeDataUrl(dataUrl: string) {
    const encoded = dataUrl.includes(",") ? dataUrl.split(",").pop() : dataUrl;
    return Buffer.from(encoded ?? "", "base64");
  }

  private extensionFor(mimeType: string) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("webp")) return "webp";
    return "jpg";
  }
}
