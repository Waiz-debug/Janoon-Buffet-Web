import { ContactFooter } from "@/components/tribe/ContactFooter";
import { SiteHeader } from "@/components/tribe/SiteHeader";
import { SmartImage } from "@/components/tribe/SmartImage";
import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { Button } from "@/components/ui/button";
import { useGoToSection } from "@/hooks/use-go-to-section";
import { useLiveSite } from "@/hooks/use-live-site";
import { BUFFET_TIERS, RESTAURANT } from "@/lib/restaurant";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  Check,
  Loader2,
  Phone,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router";

export default function MenuDetail() {
  const { slug } = useParams<{ slug: string }>();
  const goToSection = useGoToSection();
  const { getDish, getCounter, dishes, dishesByCategory, menuReady } =
    useLiveSite();
  const dish = slug ? getDish(slug) : undefined;

  useEffect(() => {
    document.title = dish
      ? `${dish.name} · ${RESTAURANT.name}`
      : `Menu · ${RESTAURANT.name}`;
  }, [dish]);

  // The first paint carries the built-in catalogue, so a dish the owner has
  // published may not be in it yet. Telling a guest "that dish is not on the
  // menu tonight" before the live read has answered would be wrong — and a
  // shared dish link is exactly where that happens.
  if (!dish && !menuReady) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 px-4 py-32 sm:px-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">
            Loading the menu…
          </span>
        </main>
        <ContactFooter />
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 py-32 text-center sm:px-6">
          <span className="text-[0.7rem] tracking-[0.22em] text-gold uppercase">
            Dish not found
          </span>
          <h1 className="font-display text-3xl font-semibold">
            That dish is not on the menu tonight
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            It may have been renamed or rotated out. Browse the full buffet to see
            what is being served this evening.
          </p>
          <Button asChild className="gap-2">
            <Link to="/restaurant#menu">
              <ArrowLeft className="size-4" aria-hidden />
              Back to the menu
            </Link>
          </Button>
        </main>
        <ContactFooter />
      </div>
    );
  }

  const category = getCounter(dish.categoryId);
  const Icon = category ? CATEGORY_ICONS[category.icon] : undefined;
  const pairings = (dish.pairings ?? [])
    .map((paired) => getDish(paired))
    .filter((paired): paired is NonNullable<typeof paired> => Boolean(paired));
  const alsoTry = dishesByCategory(dish.categoryId).filter(
    (item) => item.slug !== dish.slug,
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="pt-16 sm:pt-20">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 pt-8 text-xs text-muted-foreground sm:px-6"
        >
          <Link to="/restaurant#menu" className="transition-colors hover:text-gold">
            Menu
          </Link>
          <span aria-hidden>/</span>
          <Link to="/restaurant#menu" className="transition-colors hover:text-gold">
            {category?.name ?? "Buffet"}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{dish.name}</span>
        </nav>

        {/* Dish */}
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="order-2 flex flex-col gap-7 lg:order-1"
          >
            <div className="flex flex-col gap-4">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[0.7rem] tracking-[0.2em] text-gold uppercase">
                {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
                {category?.name ?? "Buffet"}
              </span>
              <h1 className="font-display text-4xl leading-tight font-semibold text-balance sm:text-5xl">
                {dish.name}
              </h1>
              <p className="text-sm text-gold/80">{dish.urdu}</p>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                {dish.description}
              </p>
            </div>

            <dl className="grid gap-x-6 gap-y-5 border-t border-border/70 pt-7 sm:grid-cols-3">
              {dish.notes.map((note) => (
                <div key={note.label}>
                  <dt className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                    {note.label}
                  </dt>
                  <dd className="mt-1.5 text-sm leading-snug">{note.value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                size="lg"
                className="h-12 gap-2 shadow-lg shadow-black/30"
                onClick={() => goToSection("reserve")}
              >
                <CalendarCheck className="size-4" aria-hidden />
                Book Buffet
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 gap-2 border-border/70"
              >
                <a href={RESTAURANT.phoneHref}>
                  <Phone className="size-4" aria-hidden />
                  Call {RESTAURANT.phoneDisplay}
                </a>
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Served as part of the all-you-can-eat buffet — {RESTAURANT.buffetRange}{" "}
              per person, unlimited refills.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="order-1 lg:order-2"
          >
            <div className="relative overflow-hidden rounded-3xl border border-border/70">
              <SmartImage
                src={dish.image}
                alt={dish.name}
                loading="eager"
                className="aspect-[4/3] w-full object-cover lg:aspect-[4/5]"
              />
              <span className="absolute top-4 left-4 rounded-full border border-gold/30 bg-background/85 px-3 py-1.5 text-[0.65rem] tracking-[0.18em] text-gold uppercase backdrop-blur">
                Included in every buffet
              </span>
            </div>
          </motion.div>
        </section>

        {/* Buffet inclusion */}
        <section className="hearth-texture border-y border-border/60 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-4">
              <span className="text-[0.7rem] tracking-[0.22em] text-gold uppercase">
                How it is served
              </span>
              <h2 className="max-w-2xl font-display text-2xl font-semibold text-balance sm:text-3xl">
                One ticket, four counters — {dish.name} included without limit
              </h2>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {BUFFET_TIERS.map((tier) => (
                <div
                  key={tier.label}
                  className="rounded-2xl border border-border/70 bg-card/50 p-6"
                >
                  <p className="text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
                    {tier.label}
                  </p>
                  <p className="mt-2 font-display text-3xl font-semibold text-gold">
                    {tier.price}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{tier.note}</p>
                </div>
              ))}
            </div>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Unlimited refills from the live counter",
                "Tandoori naan, sheermal and roti to order",
                "Salad bar, raita and house chutneys",
                "Soft drinks, lassi and Kashmiri chai",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-gold/30 text-gold">
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span className="text-muted-foreground">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pairings */}
        {pairings.length > 0 ? (
          <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="font-display text-2xl font-semibold">Pairs well with</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {pairings.map((pairing) => (
                <Link
                  key={pairing.slug}
                  to={`/menu/${pairing.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-gold/35"
                >
                  <SmartImage
                    src={pairing.image}
                    alt={pairing.name}
                    className="size-20 shrink-0 rounded-xl object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-semibold transition-colors group-hover:text-gold">
                      {pairing.name}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {pairing.summary}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="ml-auto size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-gold"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Rest of the counter */}
        {alsoTry.length > 0 ? (
          <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold">
                Also from {category?.name ?? "the buffet"}
              </h2>
              <Link
                to="/restaurant#menu"
                className="text-xs tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-gold"
              >
                Full menu
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {alsoTry.map((item) => (
                <Link
                  key={item.slug}
                  to={`/menu/${item.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/50 transition-colors hover:border-gold/35"
                >
                  <SmartImage
                    src={item.image}
                    alt={item.name}
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <span className="flex flex-1 flex-col gap-1.5 p-4">
                    <span className="font-display text-base font-semibold transition-colors group-hover:text-gold">
                      {item.name}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {item.summary}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
          <Link
            to="/restaurant#menu"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-gold"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to the full menu ({dishes.length} dishes)
          </Link>
        </section>
      </main>

      <ContactFooter />
    </div>
  );
}
