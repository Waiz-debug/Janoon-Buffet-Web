-- ============================================================================
--  Janoon — admin recovery runbook
--
--  The Admin Portal decides whether to offer "Create Admin Account" from one
--  database fact and nothing else:
--
--      select public.staff_bootstrap_state();   -- { "claimable": true | false }
--
--  `claimable` is true exactly while public.staff_members holds no **active**
--  admin. The website re-asks this every time the admin sign-in card opens, so
--  there is nothing to clear in the browser, no flag to flip and no redeploy:
--  change the table, and the button follows.
--
--  Run these in the Supabase SQL Editor (Dashboard -> SQL Editor). They are
--  deliberately NOT exposed as RPCs, so they can never be called from the
--  frontend.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  1. Who can open the panel right now?
--     `claimable: true` means the setup form is being offered.
-- ---------------------------------------------------------------------------
select public.staff_bootstrap_state();

select m.user_id,
       m.email,
       m.display_name,
       m.role,
       m.active,
       u.created_at as auth_created_at
  from public.staff_members m
  left join auth.users u on u.id = m.user_id
 order by m.role, m.created_at;


-- ---------------------------------------------------------------------------
--  2. Reopen the recovery door safely.
--
--     2a. Preferred: switch an admin off instead of deleting anything. The
--         account, its password and its history all stay; it simply no longer
--         counts as an admin who can open the panel.
-- ---------------------------------------------------------------------------
--  update public.staff_members
--     set active = false
--   where user_id = '00000000-0000-0000-0000-000000000000'::uuid;

--     2b. Or remove the admin row outright — by the exact `user_id` printed in
--         step 1. This touches ONLY public.staff_members. The Supabase Auth
--         account behind it is left alone on purpose, so the same person can
--         sign in again and re-claim from "Create Admin Account" without ever
--         losing their password.
-- ---------------------------------------------------------------------------
--  delete from public.staff_members
--   where user_id = '00000000-0000-0000-0000-000000000000'::uuid;

--     2c. Remove every admin at once (keeps staff rows and all auth users):
-- ---------------------------------------------------------------------------
--  delete from public.staff_members
--   where role = 'admin';


-- ---------------------------------------------------------------------------
--  3. Confirm the door is open again. Expect { "claimable": true }.
-- ---------------------------------------------------------------------------
select public.staff_bootstrap_state();


-- ---------------------------------------------------------------------------
--  4. Optional, and destructive: wipe the team AND every Supabase Auth user.
--
--     Only for a genuine clean-slate reset — it deletes logins for real people,
--     so it must never be run without first checking step 1. Deleting from
--     auth.users cascades to auth.sessions and auth.refresh_tokens.
-- ---------------------------------------------------------------------------
--  delete from public.staff_members;
--  delete from auth.users;


-- ============================================================================
--  What the recovery door does NOT allow
--
--  * An anonymous visitor: claim_admin() needs a verified Supabase Auth
--    session (auth.uid()), and it is not granted to `anon`.
--  * A staff member promoting themselves: an account that already holds a
--    staff row is refused, so emptying the admin list is not a route from
--    staff to admin.
--  * Two competing admins at once: the table is locked for the transaction
--    before the check, so only one claim can win.
--  * Anyone, while an active admin exists: the claim is refused outright.
--
--  The window is therefore exactly "this restaurant has no admin who can open
--  the panel" — which is the state the recovery flow exists for.
-- ============================================================================
