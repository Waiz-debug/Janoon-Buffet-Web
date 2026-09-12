import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

export type UploadedImage = {
  storageId: string;
  name: string;
  mimeType: string;
  bytes: number;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export type UploadState = {
  isUploading: boolean;
  error: string | null;
};

/**
 * Shared flow for admin image uploads:
 *  1. request a short-lived Convex upload URL
 *  2. POST the file to it
 *  3. hand the resulting storage id to the caller's mutation
 */
export function useImageUpload() {
  const generateUploadUrl = useMutation(api.menu.generateUploadUrl);
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    error: null,
  });

  const upload = useCallback(
    async (file: File): Promise<UploadedImage | null> => {
      if (!ALLOWED_TYPES.has(file.type)) {
        setState({ isUploading: false, error: "Only JPEG, PNG, WebP, GIF or AVIF images are allowed." });
        return null;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setState({ isUploading: false, error: "Images must be 5 MB or smaller." });
        return null;
      }

      setState({ isUploading: true, error: null });
      try {
        const url = await generateUploadUrl();
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) {
          throw new Error(`Upload failed (${response.status})`);
        }
        const { storageId } = (await response.json()) as { storageId: string };
        setState({ isUploading: false, error: null });
        return {
          storageId,
          name: file.name,
          mimeType: file.type,
          bytes: file.size,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed. Try again.";
        setState({ isUploading: false, error: message });
        return null;
      }
    },
    [generateUploadUrl],
  );

  return { ...state, upload };
}
