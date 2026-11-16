import { isValidSession } from "../lib/auth";
import type { Env } from "../lib/env";
import { configureYahoo } from "../lib/yahoo";

// Chemins accessibles sans être connecté.
const PUBLIC = [/^\/login(\.html)?$/, /^\/api\/login$/, /^\/style\.css$/, /^\/login\.js$/, /^\/manifest\.webmanifest$/, /^\/icons\//];

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  configureYahoo(env.YAHOO_RELAY);
  const isApi = url.pathname.startsWith("/api/");

  if (!env.APP_PASSWORD || !env.SESSION_SECRET) {
    const msg = "Configuration manquante : définis les secrets APP_PASSWORD et SESSION_SECRET.";
    return isApi ? Response.json({ error: msg }, { status: 500 }) : new Response(msg, { status: 500 });
  }

  if (PUBLIC.some((re) => re.test(url.pathname)) || (await isValidSession(request, env.SESSION_SECRET))) {
    return ctx.next();
  }

  if (isApi) return Response.json({ error: "Non connecté" }, { status: 401 });
  return Response.redirect(new URL("/login", url).toString(), 302);
};
