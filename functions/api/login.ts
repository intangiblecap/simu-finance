import { createSessionCookie, passwordMatches } from "../../lib/auth";
import { Env, authEnabled, sessionSecret } from "../../lib/env";
import { errorResponse, json, readJson } from "../../lib/http";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!authEnabled(env)) return json({ ok: true });
    const { password } = await readJson<{ password?: string }>(request);
    if (typeof password !== "string" || !(await passwordMatches(password, env.APP_PASSWORD!, sessionSecret(env)))) {
      // Petit délai pour ralentir les essais en série.
      await new Promise((r) => setTimeout(r, 800));
      return json({ error: "Mot de passe incorrect" }, { status: 401 });
    }
    return json({ ok: true }, { headers: { "Set-Cookie": await createSessionCookie(sessionSecret(env)) } });
  } catch (e) {
    return errorResponse(e);
  }
};
