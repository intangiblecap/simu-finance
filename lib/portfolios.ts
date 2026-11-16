import { HttpError, isIsoDate, todayParis } from "./http";

// Validation des champs d'un portefeuille.
export function checkName(name: unknown): string {
  const n = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!n) throw new HttpError(400, "Donne un nom au portefeuille");
  if (n.length > 40) throw new HttpError(400, "Nom trop long (40 caractères maximum)");
  return n;
}

export function checkStart(date: unknown): string {
  if (!isIsoDate(date)) throw new HttpError(400, "Date de démarrage invalide");
  if (date > todayParis()) throw new HttpError(400, "La date de démarrage ne peut pas être dans le futur");
  if (date < "1990-01-01") throw new HttpError(400, "Date de démarrage trop ancienne");
  return date;
}

