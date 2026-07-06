export class PrivacyService {
  assertOwned<T extends { userId?: string } | null>(record: T, userId: string) {
    if (!record || record.userId !== userId) throw new Error("Resource not found");
    return record;
  }
}
