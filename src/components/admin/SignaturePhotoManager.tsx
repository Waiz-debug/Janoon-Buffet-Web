import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { LiveDish } from "@/hooks/use-live-site";
import { useImageUpload } from "@/hooks/use-image-upload";
import { formatRupees } from "@/lib/menu";
import { useMutation } from "convex/react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";

/**
 * Dedicated section in the Photos tab for quickly updating images on
 * signature (featured) dishes. Each card shows the dish name, price,
 * category, and a large upload area — no need to dig into the Dishes tab.
 */
export function SignaturePhotoManager({
  dishes,
  categories,
}: {
  dishes: LiveDish[];
  categories: { id: string; name: string }[];
}) {
  const signatureDishes = dishes.filter((d) => d.featured);

  if (signatureDishes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
        <Star className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          No signature dishes yet. Mark a dish as "Signature" in the Dishes tab to
          manage its photo here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-base font-semibold">
          Signature dishes
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick photo updates for your signature items — these appear in the
          highlights strip on the public site.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {signatureDishes.map((dish) => (
          <SignatureCard
            key={dish.slug}
            dish={dish}
            categoryName={
              categories.find((c) => c.id === dish.categoryId)?.name ??
              dish.categoryId
            }
          />
        ))}
      </div>
    </div>
  );
}

function SignatureCard({
  dish,
  categoryName,
}: {
  dish: LiveDish;
  categoryName: string;
}) {
  const inputId = useId();
  const setDishImage = useMutation(api.menu.uploadDishImage);
  const removeDishImage = useMutation(api.menu.removeDishImage);
  const { isUploading, upload } = useImageUpload();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await upload(file);
    if (!result) return;
    try {
      await setDishImage({
        slug: dish.slug,
        storageId: result.storageId as never,
        originalName: result.name,
        mimeType: result.mimeType,
        bytes: result.bytes,
      });
      toast.success(`${dish.name} photo updated — live on the site`);
    } catch {
      toast.error(`Could not update ${dish.name} photo`);
    }
  };

  const handleRemove = async () => {
    try {
      await removeDishImage({ slug: dish.slug });
      toast.success(`${dish.name} photo removed`);
    } catch {
      toast.error(`Could not remove ${dish.name} photo`);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gold/20 bg-card/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{dish.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {categoryName}
            {dish.pricePerPlate ? ` · ${formatRupees(dish.pricePerPlate)}` : ""}
          </p>
        </div>
        <Star className="size-4 shrink-0 text-gold" aria-hidden />
      </div>

      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/60">
        {dish.image ? (
          <img
            src={dish.image}
            alt={dish.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-3 text-center">
            <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-[0.65rem] text-muted-foreground">
              No photo yet
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => document.getElementById(inputId)?.click()}
          className="gap-1.5"
        >
          {isUploading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-3.5" aria-hidden />
          )}
          {isUploading ? "Uploading…" : dish.image ? "Replace photo" : "Upload photo"}
        </Button>
        {dish.image ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isUploading}
            onClick={() => void handleRemove()}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
