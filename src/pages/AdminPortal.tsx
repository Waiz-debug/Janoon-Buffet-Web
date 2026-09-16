import { AdminOverview } from "@/components/admin/AdminOverview";
import { AddOnManager } from "@/components/admin/AddOnManager";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { DishManager } from "@/components/admin/DishManager";
import { ExperienceManager } from "@/components/admin/ExperienceManager";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { PromotionsManager } from "@/components/admin/PromotionsManager";
import { SignaturePhotoManager } from "@/components/admin/SignaturePhotoManager";
import { PortalFrame } from "@/components/tribe/PortalFrame";
import { RecordsDesk } from "@/components/tribe/RecordsDesk";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAddOns, useAdminMenu } from "@/hooks/use-live-db";
import {
  ensureSignatureDishes,
  seedAddOns,
  seedDemoGallery,
  seedDemoPromotion,
  seedMenuCatalog,
} from "@/lib/db";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function AdminPortal() {
  const { categories, dishes, loaded, isEmpty } = useAdminMenu();
  const addons = useAdminAddOns() ?? [];
  const seeding = useRef(false);

  // First run against a fresh Supabase project: copy the built-in catalogue
  // and gallery photos across so the admin panel lists exactly the assets the
  // public site renders, then publish a sample promotional banner. Every seed
  // is idempotent and skips anything the team has already replaced.
  useEffect(() => {
    if (!loaded || seeding.current) return;
    seeding.current = true;
    void (async () => {
      try {
        if (isEmpty) {
          await seedMenuCatalog();
          toast.success("Menu catalogue loaded");
        }
        const newAddOns = await seedAddOns();
        if (newAddOns > 0) {
          toast.success(`Add-ons board loaded — ${newAddOns} items`);
        }
        const restored = await ensureSignatureDishes();
        if (restored > 0) {
          toast.success(
            `Signature section topped up to 4 dishes (+${restored})`,
          );
        }
        const tiles = await seedDemoGallery();
        if (tiles > 0) {
          toast.success(
            `Demo gallery loaded — ${tiles} ${tiles === 1 ? "tile" : "tiles"}`,
          );
        }
        if (await seedDemoPromotion()) {
          toast.success("Demo promotion published");
        }
      } catch {
        // The SQL may not be applied yet — the site still renders.
      }
    })();
  }, [loaded, isEmpty]);

  if (!loaded) {
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
      title="Menu, photos & promotions"
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

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dishes">Dishes &amp; prices</TabsTrigger>
          <TabsTrigger value="counters">Counters</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="promos">Promotions</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview />
        </TabsContent>

        <TabsContent value="dishes">
          <DishManager
            dishes={dishes}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>

        <TabsContent value="addons">
          <AddOnManager addons={addons} />
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
          <ExperienceManager />
          <PhotoManager />
        </TabsContent>

        <TabsContent value="promos">
          <PromotionsManager />
        </TabsContent>

        <TabsContent value="records" className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-base font-semibold">
              Reservations, pre-orders &amp; deliveries
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Today&apos;s incoming records up top, and the complete searchable
              history below — filter by year, month or an exact date.
            </p>
          </div>
          <RecordsDesk />
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Delivery totals are always recalculated on the server from the live
        prices set here — customers can never submit a doctored total.
      </p>
    </PortalFrame>
  );
}
