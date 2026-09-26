import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * A guest's reference code, with a one-tap copy.
 *
 * The code itself is minted by the database — `tribe_reference()` draws it and
 * the row is written in the same statement — so a guest can never be shown a
 * reference that no record carries, and the desk's "Find by Code" box always has
 * something real to match. This component only presents it: a monospaced brass
 * pill, sized for wherever it sits, with the copy button beside it because the
 * code is what a guest reads out at the door, types into the desk, and quotes on
 * the phone.
 *
 * Copy failures are reported rather than swallowed: a clipboard the browser
 * refuses (an insecure origin, an old browser) must not look like a successful
 * copy, or the guest walks in with nothing in the clipboard.
 */
export function ReferenceCode({
  code,
  label,
  size = "md",
  className,
}: {
  code: string;
  /** Optional caption above the code — "Booking reference", "Order code". */
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${code} copied to your clipboard`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy automatically", {
        description: "Select the code and copy it by hand.",
      });
    }
  };

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      {label ? (
        <span className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </span>
      ) : null}
      <span className="inline-flex items-center gap-2">
        <span
          className={cn(
            "font-mono font-semibold tracking-[0.14em] text-gold",
            size === "lg" && "font-display text-2xl",
            size === "md" && "text-sm",
            size === "sm" && "text-xs",
          )}
        >
          {code}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={`Copy reference ${code}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-2 py-1 text-[0.6rem] font-medium tracking-[0.14em] text-gold uppercase transition-colors hover:border-gold/60 hover:bg-gold/20"
        >
          {copied ? (
            <Check className="size-3" aria-hidden />
          ) : (
            <Copy className="size-3" aria-hidden />
          )}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </button>
      </span>
    </span>
  );
}
