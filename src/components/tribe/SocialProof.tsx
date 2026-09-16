import { SmartImage } from "@/components/tribe/SmartImage";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { Button } from "@/components/ui/button";
import { useLiveSite } from "@/hooks/use-live-site";
import { RESTAURANT, TESTIMONIALS } from "@/lib/restaurant";
import { motion } from "framer-motion";
import { Instagram, Star } from "lucide-react";

function StarRating({ value }: { value: number }) {
  const percentage = (value / 5) * 100;
  return (
    <span className="relative inline-flex" aria-label={`${value} out of 5 stars`}>
      <span className="flex gap-0.5 text-muted-foreground/35">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className="size-4" aria-hidden />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-0.5 overflow-hidden text-gold"
        style={{ width: `${percentage}%` }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className="size-4 shrink-0 fill-current" aria-hidden />
        ))}
      </span>
    </span>
  );
}

export function SocialProof() {
  // One list, shared with the admin panel's gallery manager.
  const posts = useLiveSite().gallery;

  return (
    <section id="reviews" className="hearth-glow scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Reviews"
          title="4.6 stars from families across Lahore"
          description="Seventy-two Google reviews and counting — most of them from families who booked ahead, stayed late and came back the next weekend."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Google rating card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col justify-between gap-6 rounded-3xl border border-gold/25 bg-card/50 p-6"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-end gap-3">
                <span className="font-display text-5xl leading-none font-semibold text-gold">
                  {RESTAURANT.rating}
                </span>
                <div className="pb-1">
                  <StarRating value={RESTAURANT.rating} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {RESTAURANT.reviewCount}+ Google reviews
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Guests mention the live BBQ counters, the open-air seating and how
                easily big family tables are handled.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full border-gold/30">
              <a href={RESTAURANT.mapsUrl} target="_blank" rel="noreferrer">
                Read the reviews on Google
              </a>
            </Button>
          </motion.div>

          {/* Testimonials */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.figure
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
                className={`flex flex-col justify-between gap-4 rounded-3xl border border-border/70 bg-card/60 p-6 ${
                  index === 0 ? "sm:col-span-2" : ""
                }`}
              >
                <div className="flex flex-col gap-3">
                  <StarRating value={testimonial.rating} />
                  <blockquote className="text-sm leading-relaxed text-foreground/90">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                </div>
                <figcaption className="flex items-center gap-3 border-t border-border/60 pt-4">
                  <span className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-sm font-semibold text-gold">
                    {testimonial.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">
                      {testimonial.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {testimonial.detail}
                    </span>
                  </span>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>

        {/* Instagram feed */}
        <div className="mt-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs tracking-[0.2em] text-gold uppercase">
              <Instagram className="size-3.5" aria-hidden />
              {RESTAURANT.instagramHandle}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold">
              Gallery
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              Six tiles from the terrace and the coals at Natha Singh Wala,
              updated from our kitchen as the week goes on.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2 self-start border-gold/30">
            <a href={RESTAURANT.instagramUrl} target="_blank" rel="noreferrer">
              <Instagram className="size-4" aria-hidden />
              Follow us
            </a>
          </Button>
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
                alt={post.caption}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/70 to-transparent p-3 text-[0.7rem] leading-snug text-foreground/90 opacity-0 transition-opacity group-hover:opacity-100">
                {post.caption}
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
