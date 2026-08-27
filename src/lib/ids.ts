import { customAlphabet } from "nanoid";

/** Lowercase alphanumerics only: URL-safe and unambiguous when read aloud. */
const suffix = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 6);

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

  return `${base || "app"}-${suffix()}`;
}
