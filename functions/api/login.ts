import { createSessionCookie, passwordMatches } from "../../lib/auth";
import type { Env } from "../../lib/env";
import { errorResponse, json, readJson } from "../../lib/http";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { password } = await readJson<{ password?: string }>(request);
    if (typeof password !== "string" || !(await passwordMatches(password, env.APP_PASSWORD, env.SESSION_SECRET))) {
      // Petit délai pour ralentir les essais en série.
      await new Promise((r) => setTimeout(r, 800));
      return json({ error: "Mot de passe incorrect" }, { status: 401 });
    }
    return json({ ok: true }, { headers: { "Set-Cookie": await createSessionCookie(env.SESSION_SECRET) } });
  } catch (e) {
    return errorResponse(e);
  }
};
