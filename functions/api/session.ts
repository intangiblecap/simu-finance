import { isValidSession } from "../../lib/auth";
import { Env, authEnabled, sessionSecret } from "../../lib/env";
import { json } from "../../lib/http";

// Indique à l'interface si l'accès est protégé et si l'utilisateur est connecté.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const protectedAccess = authEnabled(env);
  return json({
    protected: protectedAccess,
    authenticated: protectedAccess ? await isValidSession(request, sessionSecret(env)) : true,
  });
};
