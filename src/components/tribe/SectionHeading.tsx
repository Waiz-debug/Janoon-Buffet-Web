import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * The brass rule that closes a heading, with a small centred word on it —
 * "Dastarkhwan", "Mughlai", the house reminder that this is a table, not a
 * menu list. Used where a section runs long enough to need a second beat.
 */
export function SectionDivider({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="brass-rule h-px flex-1" aria-hidden />
      <span className="text-[0.6rem] tracking-[0.28em] text-gold/70 uppercase">
        {label}
      </span>
      <span className="brass-rule h-px flex-1" aria-hidden />
    </span>
  );
}

/** Small brass eyebrow label that opens every section. */
export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[0.7rem] font-medium tracking-[0.22em] text-gold uppercase">
      {children}
    </span>
  );
}

type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "flex max-w-2xl flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h2 className="font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description ? (
        <p className="text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <span className="brass-rule h-px w-28" />
    </motion.div>
  );
}
