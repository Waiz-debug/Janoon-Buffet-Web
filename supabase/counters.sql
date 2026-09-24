-- ============================================================================
--  JUNOON — counters (the cooking stations behind the menu)
--
--  A "counter" IS a row in `menu_categories`: Barbecue & Grill, Charcoal
--  Counter, Traditional Handi, and anything else the owner invents. The items
--  on it are the `menu_dishes` rows whose `category_id` points at it. That
--  shape already exists in supabase/schema.sql, so this file adds only what the
--  counter workflow needs on top of it and changes no row:
--
--    1. The `uncategorized` home counter — where a removed counter's items are
--       parked (switched off) instead of being stranded. Created if missing, so
--       an older project can delete a counter without the foreign key refusing.
--    2. The (category_id, sort_order) index — the public menu reads one counter
--       at a time, in menu order, and so does the admin panel.
--    3. The `menu_dishes.category_id` foreign key, if an earlier revision
--       skipped it, so an item can never point at a counter that is not there.
--    4. `menu_by_counter` — one row per counter with its item counts. Read-only,
--       for reporting and integrations; the app computes the same figures from
--       the live rows it already subscribes to.
--
--  Idempotent: paste the whole file and re-run it as often as you like. Nothing
--  is dropped, nothing is deleted, no business table is rewritten.
-- ============================================================================

-- ------------------------------------------------- the home for orphans -----
--  `deleteCategory()` in src/lib/db.ts moves a counter's items here *before*
--  deleting the counter. The row is inactive, so it never appears on the public
--  menu — it exists so the foreign key below can never block a delete.
insert into public.menu_categories (id, name, urdu, blurb, icon, sort_order, active)
values (
  'uncategorized', 'Other', 'دیگر',
  'Items whose counter was removed. Move them to a counter and switch them on to publish them again.',
  'flame', 99, false
)
on conflict (id) do nothing;

-- ------------------------------------------------ the counter → item index --
--  Every public counter section and every admin counter list is the same query:
--  items for one counter, in menu order. This is the index that answers it.
create index if not exists menu_dishes_category_sort_idx
  on public.menu_dishes (category_id, sort_order);

-- ------------------------------------------------- referential integrity -----
--  One item belongs to one counter. Added only when every existing row already
--  points at a real counter, so it can never fail on a database carrying legacy
--  rows; `on delete restrict` makes an orphaned item impossible from then on.
do $$
begin
  if exists (
    select 1
      from pg_constraint
     where conname = 'menu_dishes_category_fk'
       and conrelid = 'public.menu_dishes'::regclass
  ) then
    return;
  end if;

  if exists (
    select 1
      from public.menu_dishes d
     where not exists (
       select 1 from public.menu_categories c where c.id = d.category_id
     )
  ) then
    raise notice 'menu_dishes has rows pointing at a missing counter — foreign key skipped. Move them to a real counter (or to ''uncategorized'') and re-run.';
    return;
  end if;

  alter table public.menu_dishes
    add constraint menu_dishes_category_fk
    foreign key (category_id) references public.menu_categories (id)
    on update cascade on delete restrict;

  raise notice 'menu_dishes_category_fk added — items can no longer point at a missing counter.';
end $$;

-- ------------------------------------------------------- counter overview ---
--  Counters with the number of items on each, and how many of those are live.
--  `menu_categories` and `menu_dishes` are both readable by anyone by design
--  (their policies are `using (true)` — the same content ships in the bundle),
--  so this view exposes nothing that was not already public. The admin panel
--  does not depend on it: it counts the live rows it already subscribes to, so
--  a counter it has just created is counted before this view could be queried.
create or replace view public.menu_by_counter as
select
  c.id,
  c.name,
  c.urdu,
  c.blurb,
  c.icon,
  c.sort_order,
  c.active,
  count(d.id) filter (where d.active) as live_items,
  count(d.id)                        as total_items
from public.menu_categories c
left join public.menu_dishes d on d.category_id = c.id
group by c.id, c.name, c.urdu, c.blurb, c.icon, c.sort_order, c.active;

grant select on public.menu_by_counter to anon, authenticated;

-- ------------------------------------------------------------- verify -------
--  Every counter with its item counts, in menu order:
--
--    select id, name, active, live_items, total_items
--      from public.menu_by_counter
--     order by sort_order;
--
--  Items filed under a counter that no longer exists — should be empty:
--
--    select d.slug, d.name, d.category_id
--      from public.menu_dishes d
--      left join public.menu_categories c on c.id = d.category_id
--     where c.id is null;
--
--  What one counter's section will show on the guest site, in order:
--
--    select d.name, d.price_per_plate
--      from public.menu_dishes d
--     where d.category_id = 'bbq' and d.active
--     order by d.sort_order;
