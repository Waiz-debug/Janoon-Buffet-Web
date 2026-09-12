import { Button } from "@/components/ui/button";
import { useImageUpload } from "@/hooks/use-image-upload";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useId } from "react";

export type UploadResult = {
  storageId: string;
  name: string;
  mimeType: string;
  bytes: number;
  /** Local object URL for instant preview (storage URL follows the mutation). */
  previewUrl: string;
};

type ImageFieldProps = {
  label: string;
  value: string;
  hint?: string;
  /** Called after a successful upload with the storage metadata. */
  onUploaded: (upload: UploadResult) => void;
  onCleared?: () => void;
};

/**
 * Reusable admin image upload control: current photo with preview, a choose
 * button, upload status, and an optional clear action.
 */
export function ImageField({
  label,
  value,
  hint,
  onUploaded,
  onCleared,
}: ImageFieldProps) {
  const { isUploading, error, upload } = useImageUpload();
  const inputId = useId();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await upload(file);
    if (!result) return;
    onUploaded({ ...result, previewUrl: URL.createObjectURL(file) });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}

      <div className="flex items-start gap-3">
        <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/60">
          {value ? (
            <img
              src={value}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          )}
        </span>

        <div className="flex flex-col gap-2">
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="sr-only"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void handleFile(file);
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => document.getElementById(inputId)?.click()}
              className="gap-2"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-3.5" aria-hidden />
              )}
              {isUploading ? "Uploading…" : "Choose image"}
            </Button>
            {value && onCleared ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCleared}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="size-3.5" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
