import { clearSessionCookie } from "../../lib/auth";
import { json } from "../../lib/http";

export const onRequestPost: PagesFunction = async () =>
  json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
