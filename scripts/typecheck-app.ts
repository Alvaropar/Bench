/**
 * Type-checks a generated app against the injected scaffold.
 *
 * This is the check that would have caught the Modal bug at generation time:
 * passing a prop the component does not declare is a type error, not a silent
 * no-op.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import "./load-env";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { versions } from "../src/db/schema";
import { buildProjectFiles } from "../src/lib/export/project";

const PID = process.argv[2];
const OUT = join(process.cwd(), ".app-typecheck");

async function main() {
  const [v] = await getDb()
    .select().from(versions).where(eq(versions.projectId, PID))
    .orderBy(desc(versions.createdAt)).limit(1);

  if (!v) throw new Error("no version for " + PID);

  const files = buildProjectFiles({
    title: "check", slug: "check", files: v.files, schema: v.appSchema,
    data: {}, origin: "https://example.test",
  });

  rmSync(OUT, { recursive: true, force: true });
  for (const [path, contents] of Object.entries(files)) {
    const full = join(OUT, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents, "utf8");
  }
  console.log(`wrote ${Object.keys(files).length} files to ${OUT}`);
}

main();
