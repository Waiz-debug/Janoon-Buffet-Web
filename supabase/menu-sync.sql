-- ============================================================================
--  JUNOON — menu & counter write check (with repairs)
--
--  Why this file exists
--  -------------------
--  The admin panel and the guest site read the same two tables:
--  `menu_categories` (the counters) and `menu_dishes` (the items, each filed
--  under a counter through `category_id`). The panel edits them directly, so
--  anything in them is visible and editable there.
--
--  A project can still end up with counters and no items at all. The database
--  refuses the inserts, and because the starter catalogue used to be written as
--  one batch, a single refusal meant not one dish reached the table — while the
--  counters beside it were fine. The symptom is a guest menu with nothing on it
--  and a Menu tab in the admin panel with nothing in it, and no clue which
--  database rule said no.
--
--  There are only two things a Postgres project can refuse here, and this
--  script tells you which one you have:
--
--    1. A constraint or a trigger on `menu_dishes` rejects the row.
--    2. The row level policies do not let a signed-in staff member write.
--
--  Everything before section 4 only reads. Every repair in section 4 is
--  idempotent: safe to run as often as you like, and a no-op on a database that
--  is already right.
--
--  This script never inserts menu data. The starter catalogue lives in
--  src/lib/menu.ts and is written by the admin panel ("Load the starter
--  catalogue" in the Menu tab), so there is one place that decides what the
--  menu is, and this file never becomes a second, drifting copy of it.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  1. What is actually stored?
--
--  "Counters but no dishes" is the state this file exists for. Everything
--  after this line assumes you have looked at it.
-- ---------------------------------------------------------------------------
select
  'counters' as what,
  count(*)                        as rows,
  count(*) filter (where active)  as published
  from public.menu_categories
union all
select
  'dishes',
  count(*),
  count(*) filter (where active)
  from public.menu_dishes;

-- Every counter with the number of items filed under it.
select
  c.id,
  c.name,
  c.sort_order,
  c.active,
  count(d.slug) filter (where d.active) as live_items,
  count(d.slug)                        as total_items
  from public.menu_categories c
  left join public.menu_dishes d on d.category_id = c.id
 group by c.id, c.name, c.sort_order, c.active
 order by c.sort_order, c.name;


-- ---------------------------------------------------------------------------
--  2. Will the database accept the row the app writes?   (constraint/trigger)
--
--  This runs as the SQL editor's role, which bypasses row level security. So:
--
--    ACCEPTED  -> the row shape is fine; the block is in the policies (go to 3)
--    REJECTED  -> a constraint or the signature trigger said no (fixed in 4a/4d)
--
--  The probe deletes its own row, and writes an inactive dish on a counter that
--  already exists, so nothing public is affected either way.
-- ---------------------------------------------------------------------------
do $$
declare
  probe_slug  constant text := '__junoon_write_probe__';
  probe_counter text;
  rejected    text;
begin
  select id into probe_counter
    from public.menu_categories
   order by sort_order, name
   limit 1;

  begin
    insert into public.menu_dishes
      (slug, name, category_id, price_per_plate, active, featured, demo,
       sort_order, updated_at)
    values
      (probe_slug, 'Write probe', coalesce(probe_counter, 'uncategorized'), 0,
       false, false, false, 0, 0);

    delete from public.menu_dishes where slug = probe_slug;
    raise notice 'menu_dishes write probe: ACCEPTED';
  exception when others then
    rejected := sqlerrm;
    raise notice 'menu_dishes write probe: REJECTED — %', rejected;
  end;
end $$;


-- ---------------------------------------------------------------------------
--  3. Is a signed-in staff member allowed to write there?   (row level security)
--
--  The panel writes with the signed-in account's Supabase session, so what
--  matters is the policy set. Expect five policies across the two menu tables:
--  a public read for the guest site, and insert / update / delete for staff.
-- ---------------------------------------------------------------------------
select
  tablename,
  policyname,
  cmd,
  roles::text as roles,
  qual,
  with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('menu_categories', 'menu_dishes')
 order by tablename, policyname;

-- A verdict, so the answer is not something you have to eyeball: every count
--  below should read 1. A 0 is what blocks the panel, and 4c puts it back.
select
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'menu_categories_public_read')  as counters_read,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'menu_categories_staff_insert') as counters_insert,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'menu_categories_staff_update') as counters_update,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'menu_categories_staff_delete') as counters_delete,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'menu_dishes_public_read')      as dishes_read,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'menu_dishes_staff_insert')     as dishes_insert,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'menu_dishes_staff_update')     as dishes_update,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'menu_dishes_staff_delete')     as dishes_delete;


-- ===========================================================================
--  4. Repairs — idempotent. Nothing below changes or deletes a dish, and the
--     one row it adds is the counter the app itself depends on.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  4a. The home counter for items whose counter was removed.
--
--  `deleteCategory()` in src/lib/db.ts moves the items off a counter being
--  deleted onto `uncategorized` before the delete — so this row, switched off so
--  guests never see it, has to exist or that save is refused. The same insert
--  lives in supabase/schema.sql and supabase/counters.sql; it is repeated here
--  so this file is enough on its own, and `on conflict do nothing` means it
--  never touches a row that is already there.
-- ---------------------------------------------------------------------------
insert into public.menu_categories (id, name, urdu, blurb, icon, sort_order, active)
values (
  'uncategorized', 'Other', 'دیگر',
  'Dishes whose counter was removed from the menu.', 'flame', 99, false
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
--  4b. `slug` has to be unique.
--
--  A dish is found by its slug everywhere — edit it, hide it, move it to
--  another counter, delete it — and the server-side delivery pricing looks it
--  up the same way. `create table if not exists` never adds a constraint to a
--  table that already exists, so a project created from an older copy of the
--  schema can be missing it, and a write batch that resolves conflicts on the
--  slug is then rejected outright.
--
--  Duplicates are reported rather than deleted: which of the two rows the owner
--  meant to keep is their decision, not this script's.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.menu_dishes group by slug having count(*) > 1
  ) then
    raise notice
      'menu_dishes holds duplicate slugs — the unique index was skipped. The duplicates are listed below; rename or delete them, then re-run this file.';
  else
    execute
      'create unique index if not exists menu_dishes_slug_key on public.menu_dishes (slug)';
    raise notice 'menu_dishes slug index: ready';
  end if;
end $$;

select slug, count(*) as rows
  from public.menu_dishes
 group by slug
having count(*) > 1
 order by slug;


-- ---------------------------------------------------------------------------
--  4c. The public read and the four staff write policies, on both menu tables.
--
--  Written exactly as supabase/schema.sql writes them, so a project that ran an
--  older copy of that file cannot drift away from the app's expectations. The
--  old single "all" policies are dropped first, which is the same order the
--  schema file uses.
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  if to_regprocedure('public.is_staff()') is null then
    raise notice
      'public.is_staff() is missing, so the staff policies cannot be created. Run supabase/schema.sql first, then re-run this file.';
    return;
  end if;

  foreach tbl in array array['menu_categories', 'menu_dishes'] loop
    execute format('drop policy if exists %I on public.%I', tbl || '_all', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_staff_write', tbl);

    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   tbl || '_public_read', tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_staff())',
                   tbl || '_staff_insert', tbl);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())',
                   tbl || '_staff_update', tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_staff())',
                   tbl || '_staff_delete', tbl);
  end loop;

  raise notice 'menu_categories + menu_dishes policies: written';
end $$;


-- ---------------------------------------------------------------------------
--  4d. The table privileges those policies sit on.
--
--  Supabase grants these to the roles by default; re-granting is harmless and
--  repairs a project where they were revoked.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.menu_categories, public.menu_dishes to anon, authenticated;
grant insert, update, delete on public.menu_categories, public.menu_dishes to authenticated;


-- ---------------------------------------------------------------------------
--  4e. The four-signature-dish limit.
--
--  The guest page has a Signatures strip of exactly four dishes, so the database
--  refuses a fifth. Restored here as the current rule, which counts the other
--  featured rows rather than the one being written — the version that stops a
--  dish from blocking its own save.
-- ---------------------------------------------------------------------------
create or replace function public.tribe_limit_signature_dishes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not new.featured then
      return new;
    end if;
  else
    if not new.featured or old.featured then
      return new;
    end if;
  end if;

  if (select count(*) from public.menu_dishes
       where featured and slug <> new.slug) >= 4 then
    raise exception
      'Only four signature dishes are allowed. Clear one before featuring another.';
  end if;

  return new;
end $$;

drop trigger if exists menu_dishes_signature_limit on public.menu_dishes;
create trigger menu_dishes_signature_limit
  before insert or update of featured on public.menu_dishes
  for each row execute function public.tribe_limit_signature_dishes();


-- ---------------------------------------------------------------------------
--  5. Then, in the app
--
--  Open the admin panel's **Menu** tab. With an empty `menu_dishes` it offers
--  "Load the starter catalogue", which writes the counters and the built-in
--  dishes into the two tables and refreshes both admin boards and the guest
--  menu from the same rows. If the panel reports a refusal, its message is now
--  the database's own wording — paste that back and the cause is one step
--  further along.
-- ---------------------------------------------------------------------------
select
  'counters' as what,
  count(*)                        as rows,
  count(*) filter (where active)  as published
  from public.menu_categories
union all
select
  'dishes',
  count(*),
  count(*) filter (where active)
  from public.menu_dishes;
