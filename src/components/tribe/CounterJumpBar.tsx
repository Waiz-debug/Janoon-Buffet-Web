import { scrollToSection } from "@/lib/scroll";
import { cn } from "@/lib/utils";

/**
 * Quick-jump tabs across a long menu board.
 *
 * The board is never filtered away: every counter stays on the page, in order,
 * top to bottom, so the whole menu is always scrollable and each section keeps
 * the dishes filed under it. The tabs only move the guest — one tap scrolls that
 * section under the header and marks it current, and "All" returns to the top of
 * the board.
 *
 * Each target carries a `scroll-mt` of its own, so the sticky header never
 * covers the heading a guest lands on. The row scrolls sideways on a narrow
 * screen instead of wrapping into a wall of chips, and it hides itself when
 * there is nothing to jump between.
 */
export function CounterJumpBar({
  items,
  activeId,
  onChange,
  allLabel = "All",
  /** Element ids are `<prefix>-<id>`, so the board and its tabs agree. */
  targetPrefix = "counter",
  sectionId = "counters",
  className,
}: {
  items: { id: string; name: string }[];
  activeId: string | null;
  onChange: (id: string | null) => void;
  allLabel?: string;
  targetPrefix?: string;
  sectionId?: string;
  className?: string;
}) {
  if (items.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Jump to a section"
      className={cn(
        "-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0",
        className,
      )}
    >
      <JumpChip
        active={activeId === null}
        onClick={() => {
          onChange(null);
          scrollToSection(sectionId);
        }}
      >
        {allLabel}
      </JumpChip>
      {items.map((item) => (
        <JumpChip
          key={item.id}
          active={activeId === item.id}
          onClick={() => {
            onChange(item.id);
            scrollToSection(`${targetPrefix}-${item.id}`);
          }}
        >
          {item.name}
        </JumpChip>
      ))}
    </div>
  );
}

function JumpChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-[0.7rem] tracking-[0.14em] uppercase transition-colors",
        active
          ? "border-gold/50 bg-gold/15 text-gold"
          : "border-border/70 text-muted-foreground hover:border-gold/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
