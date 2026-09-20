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
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4"
    >
      {/* Subtle hearth glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_45%_at_50%_40%,rgba(227,179,65,0.06),transparent_70%)]"
      />

      <div className="flex flex-col items-center text-center">
        <JanoonMark className="size-14" alt="Janoon" />

        <h1 className="mt-6 font-display text-6xl font-semibold tracking-tight text-foreground">
          404
        </h1>

        <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
          That page does not exist — it may have been moved or is not part of the
          restaurant site.
        </p>

        <Button asChild size="lg" className="mt-8 gap-2">
          <Link to="/restaurant">
            <ArrowLeft className="size-4" aria-hidden />
            Back to the restaurant
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
