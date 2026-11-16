import { isValidSession } from "../lib/auth";
import { Env, authEnabled, sessionSecret } from "../lib/env";
import { ensureSchema } from "../lib/schema";
import { configureYahoo } from "../lib/yahoo";

// Chemins accessibles sans être connecté.
const PUBLIC = [
  /^\/login(\.html)?$/,
  /^\/api\/login$/,
  /^\/api\/session$/,
  /^\/style\.css$/,
  /^\/login\.js$/,
  /^\/manifest\.webmanifest$/,
  /^\/icons\//,
];

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  configureYahoo(env.YAHOO_RELAY);
  const isApi = url.pathname.startsWith("/api/");
  if (isApi) await ensureSchema(env.DB);

  // Sans APP_PASSWORD : accès libre (l'interface affiche un avertissement).
  if (!authEnabled(env)) {
    if (/^\/login(\.html)?$/.test(url.pathname)) return Response.redirect(new URL("/", url).toString(), 302);
    return ctx.next();
  }

  if (PUBLIC.some((re) => re.test(url.pathname)) || (await isValidSession(request, sessionSecret(env)))) {
    return ctx.next();
  }

  if (isApi) return Response.json({ error: "Non connecté" }, { status: 401 });
  return Response.redirect(new URL("/login", url).toString(), 302);
};
