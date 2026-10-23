/** Shared by client + server. These limits mirror the database constraints and the bucket config (server-side authority). */
export const MEDIA_BUCKET = "memory-media";
export const MAX_FILE_BYTES = 52_428_800; // 50 MB
export const MAX_FILES_PER_MEMORY = 12;
export const SIGNED_URL_SECONDS = 3600;
export const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/webm";

const TYPES: Record<string, { ext: string; kind: "image" | "video" }> = {
  "image/jpeg": { ext: "jpg", kind: "image" }, "image/png": { ext: "png", kind: "image" }, "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" }, "image/heic": { ext: "heic", kind: "image" }, "image/heif": { ext: "heif", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" }, "video/quicktime": { ext: "mov", kind: "video" }, "video/webm": { ext: "webm", kind: "video" },
};
export const mediaInfo = (mime: string) => TYPES[mime];
/** Friendly client-side check (convenience only: the database and Storage enforce the same rules). */
export function validateFile(f: File): string | null {
  if (!TYPES[f.type]) return `“${f.name}” isn't a supported photo or video.`;
  if (f.size < 1) return `“${f.name}” is empty.`;
  if (f.size > MAX_FILE_BYTES) return `“${f.name}” is larger than 50 MB.`;
  return null;
}
export const mediaPath = (worldId: string, memoryId: string, mime: string) =>
  `${worldId}/${memoryId}/${crypto.randomUUID()}.${TYPES[mime].ext}`;
