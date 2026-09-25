import { JanoonMark } from "@/components/tribe/JanoonMark";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="candlelit flex min-h-screen flex-col items-center justify-center bg-background px-4"
    >

      <div className="flex flex-col items-center text-center">
        <JanoonMark className="size-14" alt="Janoon" />

        <span className="mt-6 text-[0.65rem] font-medium tracking-[0.28em] text-gold/80 uppercase">
          Junoon
        </span>
        <h1 className="mt-2 font-display text-6xl font-semibold tracking-tight text-foreground">
          404
        </h1>

        <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
          That page does not exist — it may have been moved or is not part of the
          restaurant site.
        </p>

        <Button
          asChild
          size="lg"
          className="mt-8 gap-2 bg-gradient-to-r from-champagne to-gold font-semibold text-primary-foreground"
        >
          <Link to="/restaurant">
            <ArrowLeft className="size-4" aria-hidden />
            Back to the restaurant
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
