import { AdminOverview } from "@/components/admin/AdminOverview";
import { AddOnManager } from "@/components/admin/AddOnManager";
import { CountersManager } from "@/components/admin/CountersManager";
import { ExperienceManager } from "@/components/admin/ExperienceManager";
import { HeroPhotoManager } from "@/components/admin/HeroPhotoManager";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { PreOrderManager } from "@/components/admin/PreOrderManager";
import { PromotionsManager } from "@/components/admin/PromotionsManager";
import { SetupNotice } from "@/components/admin/SetupNotice";
import { SignaturePhotoManager } from "@/components/admin/SignaturePhotoManager";
import { StaffManager } from "@/components/admin/StaffManager";
import { AccountSettings } from "@/components/staff/AccountSettings";
import { PortalFrame } from "@/components/tribe/PortalFrame";
import { RecordsDesk } from "@/components/tribe/RecordsDesk";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdminAddOnCategories,
  useAdminAddOns,
  useAdminMenu,
  useAdminPreOrderItems,
} from "@/hooks/use-live-db";
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
  const addonCategories = useAdminAddOnCategories();
  const preOrderItems = useAdminPreOrderItems();
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
      } catch (error) {
        // Nearly always the schema has not been applied yet. Reporting it beats
        // leaving the owner staring at an empty panel that silently does
        // nothing — see the setup panel at the top of this page.
        toast.error("Could not load the demo content", {
          description:
            error instanceof Error
              ? error.message.split("\n")[0]
              : "Run supabase/schema.sql, then reopen this panel.",
          duration: 12000,
        });
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
      <SetupNotice />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          {dishes.length} dishes live
        </span>
        <span className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          {categories.length} categories
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
          <TabsTrigger value="counters">Menu categories</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="preorders">Pre-order items</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="promos">Promotions</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview />
        </TabsContent>

        <TabsContent value="counters" className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-base font-semibold">
              Menu categories &amp; their items
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a category, then add its items from inside it. The public
              menu draws one counter per category, in this order.
            </p>
          </div>
          <CountersManager
            categories={categories.map((category) => ({
              id: category.id,
              name: category.name,
              urdu: category.urdu,
              blurb: category.blurb,
              icon: category.icon,
              sortOrder: category.sortOrder ?? 0,
              active: category.active ?? true,
            }))}
            dishes={dishes}
          />
        </TabsContent>

        <TabsContent value="addons">
          <AddOnManager
            addons={addons}
            categories={addonCategories ?? []}
            categoriesLoaded={addonCategories !== undefined}
          />
        </TabsContent>

        <TabsContent value="preorders" className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-base font-semibold">
              Pre-order &amp; takeaway items
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything guests can reserve ahead of time. Add, edit or remove as
              many items as you like — each one appears on the public pre-order
              form the moment you save, and the requests land on the staff desk
              in real time.
            </p>
          </div>
          <PreOrderManager
            items={preOrderItems ?? []}
            loading={preOrderItems === undefined}
          />
        </TabsContent>

        <TabsContent value="photos" className="flex flex-col gap-8">
          <HeroPhotoManager />
          <ExperienceManager />
          <SignaturePhotoManager
            dishes={dishes}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
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

        <TabsContent value="team" className="flex flex-col gap-10">
          <StaffManager />

          {/* The owner's own credentials, same panel the floor team gets. */}
          <div className="border-t border-border/70 pt-10">
            <AccountSettings />
          </div>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Delivery totals are always recalculated on the server from the live
        prices set here — customers can never submit a doctored total.
      </p>
    </PortalFrame>
  );
}
