export class ImageStorageService {
  normalize(input: { imageUrl: string; thumbnailUrl?: string | null }) {
    return {
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl ?? input.imageUrl
    };
  }
}
