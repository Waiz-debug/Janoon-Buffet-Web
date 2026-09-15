import { uploadImage, type UploadedImage } from "@/lib/db";
import { useCallback, useState } from "react";

export type UploadState = {
  isUploading: boolean;
  error: string | null;
};

/**
 * Shared flow for admin image uploads: push the file to the public Supabase
 * storage bucket and hand the resulting object path to the caller, which
 * stores it on the dish, gallery slot or promotion row.
 */
export function useImageUpload(folder?: string) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    error: null,
  });

  const upload = useCallback(
    async (file: File): Promise<UploadedImage | null> => {
      setState({ isUploading: true, error: null });
      try {
        const result = await uploadImage(file, folder);
        setState({ isUploading: false, error: null });
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed. Try again.";
        setState({ isUploading: false, error: message });
        return null;
      }
    },
    [folder],
  );

  return { ...state, upload };
}
