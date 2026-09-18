import { Button } from "@/components/ui/button";
import { checkSupabaseSchema, type SchemaStatus } from "@/lib/db";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Reports whether the Supabase project behind this site is actually ready.
 *
 * Without this, a project where `supabase/schema.sql` has never been run looks
 * like a site that simply refuses to update: every read fails, the public pages
 * quietly fall back to their built-in catalogue and every admin save is
 * rejected. The owner gets told that, in one place, in plain language.
 */
export function SetupNotice() {
  const [status, setStatus] = useState<SchemaStatus | null>(null);
  const [checking, setChecking] = useState(false);

  // Only flips back to false here: the flag is turned on by whoever asks for a
  // check. Setting it at the top of this function would mean a synchronous
  // state update from inside the mount effect below, which is exactly the
  // cascading render React warns about.
  const check = useCallback(async () => {
    try {
      setStatus(await checkSupabaseSchema());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (!status) {
    return (
      <p className="mb-6 flex items-center gap-2 rounded-2xl border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking the Supabase connection…
      </p>
    );
  }

  if (status.ready) {
    return (
      <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden />
        <span className="font-medium text-emerald-300">Live sync active.</span>
        <span className="text-muted-foreground">
          Every change here publishes to the customer site immediately — no
          reload needed on their side.
        </span>
      </p>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mb-6 flex flex-col gap-4 rounded-2xl border-2 border-amber-500/50 bg-amber-500/[0.08] p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300">
          <AlertTriangle className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-amber-200">
            Database not set up — nothing can sync yet
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            This project&apos;s Supabase database is missing the tables the site
            reads and writes. Until they exist, the public pages show their
            built-in content and every change saved here is rejected — which is
            why the admin panel and the customer site can look out of step.
          </p>
        </div>
      </div>

      {status.missing.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-background/40 p-4">
          <p className="flex items-center gap-2 text-xs tracking-[0.14em] text-muted-foreground uppercase">
            <Database className="size-3.5" aria-hidden />
            {status.missing.length} missing{" "}
            {status.missing.length === 1 ? "table" : "tables"}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {status.missing.map((item) => (
              <li
                key={item.table}
                className="rounded-lg border border-border/70 bg-card/50 px-2 py-1 font-mono text-[0.7rem] text-muted-foreground"
                title={item.table}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {status.missingFunctions.length > 0 ? (
        <div className="rounded-xl border-2 border-amber-500/40 bg-background/40 p-4">
          <p className="flex items-center gap-2 text-xs tracking-[0.14em] text-muted-foreground uppercase">
            <Database className="size-3.5" aria-hidden />
            {status.missingFunctions.length} database function
            {status.missingFunctions.length === 1 ? "" : "s"} missing
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The tables are all in place, but the functions this site calls are
            not — the booking, pre-order and delivery forms write through some
            of them, and the one-time owner setup needs another. That is what
            running an older copy of the schema looks like, and it means those
            three forms would be rejected. Re-run this repository&apos;s{" "}
            <span className="font-mono text-xs text-foreground">
              supabase/schema.sql
            </span>{" "}
            — it only adds what is missing.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {status.missingFunctions.map((name) => (
              <li
                key={name}
                className="rounded-lg border border-border/70 bg-card/50 px-2 py-1 font-mono text-[0.7rem] text-muted-foreground"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!status.storageReady ? (
        <p className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
          The <span className="font-mono text-xs">tribe-media</span> storage
          bucket is not reachable either, so image uploads will fail.{" "}
          {status.storageMessage ? (
            <span className="opacity-80">({status.storageMessage})</span>
          ) : null}
        </p>
      ) : null}

      {status.unreachable && status.missing.length === 0 ? (
        <p className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
          The Supabase project could not be reached at all — check the URL and
          key, and that this device is online.
        </p>
      ) : null}

      <div className="rounded-xl border border-border/70 bg-background/40 p-4">
        <p className="text-sm font-medium">How to fix it</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Open your Supabase project → <span className="text-foreground">SQL Editor</span>.
          </li>
          <li>
            Paste the whole of{" "}
            <span className="font-mono text-xs text-foreground">
              supabase/schema.sql
            </span>{" "}
            from this repository and run it. It is idempotent — safe to run more
            than once.
          </li>
          <li>
            Come back here and press{" "}
            <span className="text-foreground">Recheck</span>.
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setChecking(true);
            void check();
          }}
          disabled={checking}
          className="gap-2"
        >
          {checking ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Recheck
        </Button>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Open Supabase dashboard
        </a>
      </div>
    </motion.div>
  );
}
