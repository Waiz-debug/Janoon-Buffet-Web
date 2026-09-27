/**
 * Where a Supabase email link should send the person who opens it.
 *
 * One rule, one place, because getting it wrong is what makes a reset link look
 * broken: Supabase rewrites any redirect it does not recognise to the
 * project's own Site URL. If that is a development address, a member clicking
 * "reset my password" in their own inbox is handed a `localhost` page, on a
 * port that belongs to somebody else's machine, and the flow dies there.
 *
 * The address is therefore built from the origin the browser is actually
 * running on, so a link sent from a preview and opened anywhere lands somewhere
 * real. `VITE_SITE_URL` overrides it — set it to the address the restaurant is
 * really served from, and the link is right even when the admin is working on a
 * preview at the time they send it.
 *
 * The same origin belongs in Supabase's own **Site URL** setting, because that
 * is the fallback for any link that carries no redirect at all.
 */
function siteOrigin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const configured = (
    import.meta.env?.VITE_SITE_URL as string | undefined
  )?.replace(/\/+$/, "");
  return configured || window.location.origin;
}

/** A link back to a page on this site, by path. */
export function siteUrl(path: string): string | undefined {
  const origin = siteOrigin();
  if (!origin) return undefined;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Where a password-recovery link must land: the page that can actually finish
 * the job. The gateway would swallow the session and show a sign-in card, which
 * is why a reset link used to look like it had done nothing.
 */
export function recoveryRedirect(): string | undefined {
  return siteUrl("/update-password");
}

/** Where a confirmation link lands: the gateway, which completes the sign-in. */
export function confirmationRedirect(): string | undefined {
  return siteUrl("/?unlock=admin");
}
