import { CategoryManager } from "@/components/admin/CategoryManager";
import { DishManager } from "@/components/admin/DishManager";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { SignaturePhotoManager } from "@/components/admin/SignaturePhotoManager";
import { PortalFrame } from "@/components/tribe/PortalFrame";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { useLiveSite } from "@/hooks/use-live-site";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export default function AdminPortal() {
  const { categories, dishes } = useLiveSite();
  const ensureSeedData = useMutation(api.menu.ensureSeedData);
  const seedState = useQuery(api.menu.seedState);

  useEffect(() => {
    if (seedState?.seeded === false) {
      void ensureSeedData()
        .then(() => toast.success("Menu catalogue loaded"))
        .catch(() => undefined);
    }
  }, [seedState?.seeded, ensureSeedData]);

  if (seedState === undefined) {
    return (
      <PortalFrame
        badge="Admin portal"
        title="Menu, photos & counters"
        description="Loading the live menu…"
      >
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PortalFrame>
    );
  }

  return (
    <PortalFrame
      badge="Admin portal"
      title="Menu, photos & counters"
      description="Every change here is live on the customer site the moment you save — no redeploy needed, no refresh on the guest's side."
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          {dishes.length} dishes live
        </span>
        <span className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          {categories.length} counters
        </span>
        <Button asChild variant="outline" size="sm" className="ml-auto gap-2">
          <a href="/restaurant" target="_blank" rel="noreferrer">
            Preview public site
          </a>
        </Button>
      </div>

      <Tabs defaultValue="dishes">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="dishes">Dishes &amp; prices</TabsTrigger>
          <TabsTrigger value="counters">Counters</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
        </TabsList>

        <TabsContent value="dishes">
          <DishManager
            dishes={dishes}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>

        <TabsContent value="counters">
          <CategoryManager
            categories={categories.map((category) => ({
              id: category.id,
              name: category.name,
              urdu: category.urdu,
              blurb: category.blurb,
              icon: category.icon,
              sortOrder: category.sortOrder ?? 0,
              active: category.active ?? true,
            }))}
          />
        </TabsContent>

        <TabsContent value="photos" className="flex flex-col gap-8">
          <SignaturePhotoManager
            dishes={dishes}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
          <PhotoManager />
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Delivery totals are always recalculated on the server from the live
        prices set here — customers can never submit a doctored total.
      </p>
    </PortalFrame>
  );
}
