import { AdminOverview } from "@/components/admin/AdminOverview";
import { AddOnManager } from "@/components/admin/AddOnManager";
import { CounterHeroManager } from "@/components/admin/CounterHeroManager";
import { CountersManager } from "@/components/admin/CountersManager";
import { ExperienceManager } from "@/components/admin/ExperienceManager";
import { HeroPhotoManager } from "@/components/admin/HeroPhotoManager";
import { MenuManager } from "@/components/admin/MenuManager";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { PreOrderManager } from "@/components/admin/PreOrderManager";
import { PromotionsManager } from "@/components/admin/PromotionsManager";
import { SetupNotice } from "@/components/admin/SetupNotice";
import { SignaturePhotoManager } from "@/components/admin/SignaturePhotoManager";
import { StaffCredentialsVault } from "@/components/admin/StaffCredentialsVault";
import { StaffManager } from "@/components/admin/StaffManager";
import { AccountSettings } from "@/components/staff/AccountSettings";
import { PortalFrame } from "@/components/tribe/PortalFrame";
import { RecordsDesk } from "@/components/tribe/RecordsDesk";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { refreshAllLive } from "@/lib/live-sync";
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
  seedMenuCatalog,
} from "@/lib/db";
import { seedDemoPromotion } from "@/lib/promotions";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

/**
 * The panel's tabs, also the values `?tab=` accepts. "counters" used to hold
 * both halves of the menu; it now holds the counters alone and "menu" holds the
 * items, which is why the old value still has to work.
 */
const TAB_VALUES = new Set([
  "overview",
  "menu",
  "counters",
  "addons",
  "preorders",
  "photos",
  "promos",
  "records",
  "team",
]);

export default function AdminPortal() {
  const { categories, dishes, loaded, isEmpty } = useAdminMenu();
  const addons = useAdminAddOns() ?? [];
  const addonCategories = useAdminAddOnCategories();
  const preOrderItems = useAdminPreOrderItems();
  const seeding = useRef(false);
  const [seedingNow, setSeedingNow] = useState(false);
  const [searchParams] = useSearchParams();
  // `?tab=promos` opens the panel the public offers board links to. Anything
  // unrecognised falls back to the overview rather than an empty tab.
  const requestedTab = searchParams.get("tab") ?? "overview";
  const tab = TAB_VALUES.has(requestedTab) ? requestedTab : "overview";

  // First run against a fresh Supabase project: copy the built-in official menu
  // and gallery photos across so the admin panel lists exactly the assets the
  // public site renders, then publish a sample promotional banner. Every seed
  // is idempotent and skips anything the team has already replaced.
  //
  // "Fresh" means no dishes at all. An older starter can leave its five
  // counters active while `menu_dishes` is empty; that must still be allowed to
  // load the official menu, which retires those obsolete ids and publishes the
  // nine live stations plus seven main-menu sections.
  const nothingPublished = dishes.length === 0;
  /**
   * Every starter-content seed, each reported on its own.
   *
   * This is a function rather than the body of an effect for two reasons. One
   * refusal from the database must not hide the other seeds — a menu that will
   * not write is a different problem from a missing gallery, and the owner needs
   * the database's own words for the one that failed. And the owner needs a
   * button to try again: these seeds are the only way the two menu tables ever
   * get their first rows, so "reload the page" was the entire recovery.
   *
   * `refreshAllLive()` at the end pulls every cached table once. Realtime is
   * what normally updates the boards after a write, but a project whose
   * publication is missing a table would otherwise sit on a stale snapshot with
   * the rows already in the database.
   */
  const runSeeds = useCallback(async () => {
    if (seeding.current) return;
    seeding.current = true;
    setSeedingNow(true);
    const step = async (label: string, work: () => Promise<string | null>) => {
      try {
        const message = await work();
        if (message) toast.success(message);
      } catch (error) {
        toast.error(`Could not ${label}`, {
          description:
            error instanceof Error
              ? error.message.split("\n")[0]
              : "Run supabase/schema.sql, then try again.",
          duration: 12000,
        });
      }
    };
    try {
      await step("load the official menu", async () => {
        if (!isEmpty && !nothingPublished) return null;
        const report = await seedMenuCatalog();
        return `Official menu loaded — ${report.counters} sections, ${report.dishes} dishes, ${report.featured} signatures`;
      });
      await step("load the add-ons board", async () => {
        const added = await seedAddOns();
        return added > 0 ? `Add-ons board loaded — ${added} items` : null;
      });
      await step("top up the signature dishes", async () => {
        const restored = await ensureSignatureDishes();
        return restored > 0
          ? `Signature section topped up to 4 dishes (+${restored})`
          : null;
      });
      await step("load the demo gallery", async () => {
        const tiles = await seedDemoGallery();
        return tiles > 0
          ? `Demo gallery loaded — ${tiles} ${tiles === 1 ? "tile" : "tiles"}`
          : null;
      });
      await step("publish the sample banner", async () =>
        (await seedDemoPromotion()) ? "Demo promotion published" : null,
      );
      refreshAllLive();
    } finally {
      setSeedingNow(false);
      seeding.current = false;
    }
  }, [isEmpty, nothingPublished]);

  useEffect(() => {
    if (!loaded) return;
    void runSeeds();
  }, [loaded, runSeeds]);

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
          {dishes.length} menu items
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

      <Tabs defaultValue={tab}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="counters">Counters</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="preorders">Pre-order items</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="promos">Promotions</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview />
        </TabsContent>

        <TabsContent value="menu" className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-base font-semibold">
              Menu &amp; prices
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Every dish on the menu in one list. Change a price, move a dish to
              another counter or take it off the menu without leaving the row —
              the guest site updates the moment you save.
            </p>
          </div>
          <MenuManager
            categories={categories}
            dishes={dishes}
            onLoadStarter={() => void runSeeds()}
            seeding={seedingNow}
          />
        </TabsContent>

        <TabsContent value="counters" className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-base font-semibold">
              Counters &amp; menu sections
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Counters are the nine live High Tea stations. The same board also
              manages the seven official main-menu sections — chef specials,
              starters, vegetables, tandoor breads, salads and desserts, plus
              drinks — so every item is mapped to the right place in the guest
              menu and can be switched live. Each counter's own hero photo is
              uploaded and replaced from the Photos tab, and it is the picture
              its card wears on the guest site.
            </p>
          </div>
          <CountersManager categories={categories} dishes={dishes} />
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
          <CounterHeroManager />
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

        {/* Addresses, password checks and setup links — the recovery console. */}
        <TabsContent value="credentials">
          <StaffCredentialsVault />
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Delivery totals are always recalculated on the server from the live
        prices set here — customers can never submit a doctored total.
      </p>
    </PortalFrame>
  );
}
