import { Button } from "@/components/ui/button";
import { Flame, Lock, PanelRight, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const ROLE_CARDS = [
  {
    id: "user",
    label: "Customer",
    description:
      "Browse the buffet menu, check today's specials, and book a table for your family without signing in.",
    cta: "Open the buffet site",
    icon: Users,
    href: "/",
    accent: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/15",
    glow: "shadow-[0_0_18px_-4px_rgba(52,211,153,0.25)]",
  },
  {
    id: "staff",
    label: "Staff Portal",
    description:
      "See live table reservations and mark arrivals, confirmations, and seating from the floor.",              cta: "Enter staff PIN",
              icon: PanelRight,
              accent: "bg-sky-500/10 text-sky-300 border-sky-500/20 hover:border-sky-500/40 hover:bg-sky-500/15",
              glow: "shadow-[0_0_18px_-4px_rgba(56,189,248,0.25)]",
              pin: true,
            },
            {
              id: "admin",
              label: "Admin Portal",
              description:
                "Manage the live menu, update pricing, upload real photos, and oversee every reservation.",
              cta: "Enter admin PIN",
              icon: Lock,
              accent: "bg-amber-500/10 text-amber-300 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/15",
              glow: "shadow-[0_0_18px_-4px_rgba(251,191,36,0.25)]",
              pin: true,
            },
] as const;

export default function AuthLanding() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Warm hearth backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <HeroAmbience />
      </div>

      {/* Top bar */}
      <header className="relative z-10 border-b border-border/70 bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
              <Flame className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Tribe of Taste</p>
              <p className="text-[0.65rem] tracking-[0.2em] text-gold/80 uppercase">
                Lahore · 24/7 open buffet
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to restaurant site
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-12 text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[0.7rem] tracking-[0.2em] text-gold uppercase">
              Secure access
            </span>
            <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Who are you coming in as?
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Choose the portal you need. Guests keep the public buffet site;
              staff and admin sign in through a PIN before anything inside opens.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-3">
            {ROLE_CARDS.map((role, index) => {
              const Icon = role.icon;
              const delay = 0.12 * index;
              return (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay, ease: "easeOut" }}
                  className="group flex flex-col gap-4 rounded-2xl border bg-card/70 p-6 transition-colors hover:border-gold/25 hover:bg-card"
                >
                  <span
                    className={`flex size-12 items-center justify-center rounded-2xl border ${role.accent} glow ${
                      role.pin ? "cursor-pointer" : ""
                    }`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>

                  <div>
                    <h2 className="font-display text-lg font-semibold">
                      {role.label}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {role.description}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {role.pin ? (
                      <Button
                        asChild
                        variant="outline"
                        className={`border ${role.accent} gap-2`}
                        onClick={() => {
                          window.location.href = `/pin-auth?role=${role.id}`;
                        }}
                      >
                        <Lock className="size-3.5" aria-hidden />
                        {role.cta}
                      </Button>
                    ) : (
                      <Link to={role.href}>
                        <Button
                          variant="default"
                          size="lg"
                          className="w-full gap-2 shadow-lg shadow-black/20"
                        >
                          {role.cta}
                          <span aria-hidden>→</span>
                        </Button>
                      </Link>
                    )}
                    <p className="text-[0.7rem] text-muted-foreground/80">
                      {role.pin
                        ? "PIN: 01234 — stored locally for 24 hours"
                        : "No account needed"}
                    </p>
                  </div>
                </motion.div>              );
            })}
          </div>
          <p className="mt-10 text-center text-xs text-muted-foreground/80">
            Staff and admin portals are protected by PIN 01234. Sessions stay
            local to this browser for 24 hours.
          </p>
        </div>
      </main>
    </div>
  );
}

function HeroAmbience() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 h-[55vh] overflow-hidden"
      style={{ maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)" }}
    >
      {/* Soft ember glow behind the hero text */}
      <div className="absolute left-1/2 top-0 h-72 w-[90%] -translate-x-1/2 bg-gradient-to-b from-gold/10 via-transparent to-transparent blur-3xl" />

      {/* Subtle floating embers */}
      <div className="pointer-events-none absolute inset-x-0 top-20 h-40">
        <FloatEmber index={0} size={1.5} top={12} left={18} duration={7} delay={0} />
        <FloatEmber index={1} size={1.5} top={30} left={38} duration={8.5} delay={0.8} />
        <FloatEmber index={2} size={1.5} top={18} left={60} duration={6.5} delay={1.6} />
        <FloatEmber index={3} size={1.5} top={40} left={78} duration={9} delay={2.2} />
        <FloatEmber index={4} size={1.5} top={10} left={88} duration={7.5} delay={3} />
      </div>
    </div>
  );
}

function FloatEmber({
  index,
  size,
  top,
  left,
  duration,
  delay,
}: {
  index: number;
  size: number;
  top: number;
  left: number;
  duration: number;
  delay: number;
}) {
  return (
    <motion.span
      key={index}
      className="absolute rounded-full bg-gold/70 blur-[1px]"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: size,
        height: size,
      }}
      animate={{ y: ["0vh", "-70vh"], opacity: [0, 0.85, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}
