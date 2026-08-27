/**
 * Loads environment variables for plain Node scripts.
 *
 * Next.js reads `.env.local` automatically; `dotenv/config` does not — it only
 * looks at `.env`. Without this, `db:push` and `smoke` silently see no
 * DATABASE_URL even though the file the README tells you to create is sitting
 * right there.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL;

if (url?.includes("PASTE_YOUR")) {
  console.error(
    "\n  DATABASE_URL is still the placeholder from .env.local.\n" +
      "  Replace it with your Neon pooled connection string first.\n",
  );
  process.exit(1);
}
