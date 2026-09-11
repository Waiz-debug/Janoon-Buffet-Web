"use client";

import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface UploadState {
  file: File | null;
  preview: string | null;
  progress: number;
  status: "idle" | "uploading" | "done" | "error";
  error: string | null;
  /** Data ready for the convex asset registration mutation. */
  asset: {
    assetId: string;
    originalName: string;
    mimeType: string;
    url: string;
    width?: number;
    height?: number;
    bytes: number;
  } | null;
}

interface ImageUploaderReturn {
  upload: UploadState;
  setUpload: React.Dispatch<React.SetStateAction<UploadState>>;
  onFileChange: (file: File | null) => void;
  reset: () => void;
}

export function useImageUpload(): ImageUploaderReturn {
  const [upload, setUpload] = useState<UploadState>({
    file: null,
    preview: null,
    progress: 0,
    status: "idle",
    error: null,
    asset: null,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setUpload((prev) => ({
        ...prev,
        status: "error",
        error: "Only image files are accepted.",
        file: null,
        preview: null,
        asset: null,
      }));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setUpload((prev) => ({
        ...prev,
        status: "error",
        error: "Image must be 8MB or smaller.",
        file: null,
        preview: null,
        asset: null,
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const preview = reader.result as string;
      setUpload((prev) => ({
        ...prev,
        file,
        preview,
        status: "idle",
        error: null,
        asset: null,
      }));
    };
    reader.onerror = () => {
      setUpload((prev) => ({
        ...prev,
        status: "error",
        error: "Could not read the selected file.",
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  const onFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        setUpload((prev) => ({
          ...prev,
          file: null,
          preview: null,
          status: "idle",
          error: null,
          asset: null,
        }));
        return;
      }
      readFile(file);
    },
    [readFile],
  );

  const reset = useCallback(() => {
    setUpload({
      file: null,
      preview: null,
      progress: 0,
      status: "idle",
      error: null,
      asset: null,
    });
  }, []);

  return { upload, setUpload, onFileChange, reset };
}

interface ImageUploadProps {
  onAssetReady?: (asset: NonNullable<UploadState["asset"]>) => void;
  accept?: string;
  label?: string;
}

export function ImageUpload({
  onAssetReady,
  accept = "image/*",
  label = "Upload image",
}: ImageUploadProps) {
  const { upload, setUpload, onFileChange, reset } = useImageUpload();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0] || null;
    if (file) onFileChange(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) onFileChange(file);
  };

  const triggerFilePicker = () => inputRef.current?.click();

  const simulateUpload = async () => {
    if (!upload.file) return;
    setUpload((prev) => ({ ...prev, status: "uploading", progress: 0 }));

    // In production, replace this block with a direct Convex action that
    // uploads to Cloudinary (or your preferred host) and returns the public URL.
    // Example shape kept deliberately small on purpose so the first deployment
    // works with local hosting / direct S3 / Cloudinary later.
    const steps = 6;
    for (let i = 1; i <= steps; i += 1) {
      await new Promise((r) => setTimeout(r, 120));
      setUpload((prev) => ({ ...prev, progress: Math.round((i / steps) * 100) }));
    }

    // Generate a stable-enough ID the convex layer can use.
    const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const asset = {
      assetId,
      originalName: upload.file.name,
      mimeType: upload.file.type || "image/jpeg",
      // This placeholder URL is only for the immediate preview flow.
      // A real backend upload returns the stored URL here.
      url: URL.createObjectURL(upload.file),
      bytes: upload.file.size,
    };

    setUpload((prev) => ({
      ...prev,
      status: "done",
      progress: 100,
      asset,
    }));

    onAssetReady?.(asset);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        className="relative flex h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/70 bg-card/40 transition-colors hover:border-gold/40"
      >
        {upload.preview ? (
          <img
            src={upload.preview}
            alt={upload.file?.name ?? "Upload preview"}
            className="h-full w-full rounded-xl object-cover"
          />
        ) : (
          <>
            <Upload className="size-8 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm text-muted-foreground">{label}</p>
            <p className="text-[0.7rem] text-muted-foreground/70">
              Drop an image here or click to choose
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          tabIndex={-1}
        />
      </div>

      {upload.status !== "idle" && (
        <div className="flex items-center justify-between gap-3 text-xs">
          {upload.status === "uploading" && (
            <>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              <span className="text-muted-foreground">Uploading…</span>
            </>
          )}
          {upload.status === "done" && (
            <>
              <span className="text-emerald-300">Upload complete</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-muted-foreground"
              >
                Remove
              </Button>
            </>
          )}
          {upload.status === "error" && (
            <>
              <span className="text-destructive">{upload.error}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-muted-foreground"
              >
                Try again
              </Button>
            </>
          )}
        </div>
      )}

      {upload.status === "idle" && upload.file && (
        <Button
          type="button"
          size="sm"
          className="w-full gap-2"
          onClick={simulateUpload}
        >
          <Upload className="size-3.5" aria-hidden />
          Upload to media library
        </Button>
      )}

      {upload.asset && (
        <input
          type="hidden"
          name="uploadedAsset"
          value={JSON.stringify(upload.asset)}
          readOnly
          aria-hidden="true"
        />
      )}
    </div>
  );
}
