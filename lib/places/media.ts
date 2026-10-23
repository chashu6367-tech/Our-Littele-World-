/** Cover photo rules. Mirror the database CHECK and the private "place-media" bucket config (server-side authority). */
export const PLACE_BUCKET = "place-media";
export const MAX_COVER_BYTES = 10_485_760; // 10 MB
export const COVER_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif" };
export function validateCover(f: File): string | null {
  if (!EXT[f.type]) return `“${f.name}” isn't a supported photo.`;
  if (f.size < 1) return `“${f.name}” is empty.`;
  if (f.size > MAX_COVER_BYTES) return `“${f.name}” is larger than 10 MB.`;
  return null;
}
export const coverPath = (worldId: string, placeId: string, mime: string) => `${worldId}/${placeId}/${crypto.randomUUID()}.${EXT[mime]}`;
