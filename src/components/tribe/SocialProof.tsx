import { SmartImage } from "@/components/tribe/SmartImage";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { Button } from "@/components/ui/button";
import { useLiveSite } from "@/hooks/use-live-site";
import { RESTAURANT } from "@/lib/restaurant";
import { motion } from "framer-motion";
import { Instagram, Music2 } from "lucide-react";

/**
 * The gallery.
 *
 * This block used to carry an average rating, a review count and three guest
 * testimonials — none of which the restaurant had given us. A rating and a
 * quotation attributed to a named guest are claims about real people, so they
 * are gone: what is left is the part that is true, the photographs the owner
 * controls from the admin panel, with the caption showing only when the owner
 * has written one.
 */
export function SocialProof() {
  // One list, shared with the admin panel's gallery manager.
  const posts = useLiveSite().gallery;

  return (
    <section id="gallery" className="hearth-glow scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Gallery"
          title="From the kitchen"
          description="Photographs of the house, kept by the restaurant itself — the tiles fill in from the admin panel, so what is shown here is what the kitchen has published."
        />

        <div className="mt-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs tracking-[0.2em] text-gold uppercase">
              <Instagram className="size-3.5" aria-hidden />
              {RESTAURANT.instagramHandle}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold">
              Follow the restaurant
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              New dishes, seasonal menus and photographs of the house in{" "}
              {RESTAURANT.cityLine}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <Button asChild variant="outline" className="gap-2 border-gold/30">
              <a
                href={RESTAURANT.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="size-4" aria-hidden />
                Instagram
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2 border-gold/30">
              <a
                href={RESTAURANT.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Music2 className="size-4" aria-hidden />
                TikTok
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {posts.map((post, index) => (
            <motion.a
              key={post.slot}
              href={RESTAURANT.instagramUrl}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: index * 0.05, ease: "easeOut" }}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border/70"
            >
              <SmartImage
                src={post.url}
                alt={post.caption || `${RESTAURANT.name}, ${RESTAURANT.cityLine}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {post.caption ? (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/70 to-transparent p-3 text-[0.7rem] leading-snug text-foreground/90 opacity-0 transition-opacity group-hover:opacity-100">
                  {post.caption}
                </span>
              ) : null}
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
