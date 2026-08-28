/**
 * Type-checks a generated app against the injected scaffold.
 *
 *   npm run check:app <projectId>
 *
 * The preview compiles TypeScript without checking it, so a generated app can
 * render while quietly passing props no component declares. That is not
 * hypothetical: it is how a Modal ended up ignoring `open` and showing a dialog
 * nobody could close, and how Stat.hint and Table.loading were silently
 * dropped. Running the real compiler over the generated source against the real
 * scaffold turns that class of bug into an error with a line number.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "./load-env";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { versions } from "../src/db/schema";
import { buildProjectFiles } from "../src/lib/export/project";

const projectId = process.argv[2];
const OUT = join(process.cwd(), ".app-typecheck");

async function main() {
  if (!projectId) {
    console.error("usage: npm run check:app <projectId>");
    process.exit(2);
  }

  const [version] = await getDb()
    .select()
    .from(versions)
    .where(eq(versions.projectId, projectId))
    .orderBy(desc(versions.createdAt))
    .limit(1);

  if (!version) {
    console.error(`No version found for project ${projectId}`);
    process.exit(2);
  }

  const files = buildProjectFiles({
    title: "typecheck",
    slug: "typecheck",
    files: version.files,
    schema: version.appSchema,
    data: {},
    origin: "https://example.test",
  });

  rmSync(OUT, { recursive: true, force: true });
  for (const [path, contents] of Object.entries(files)) {
    const full = join(OUT, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents, "utf8");
  }

  const entry = join(OUT, "src", "App.tsx");
  console.log(`Checking ${Object.keys(version.files).length} generated files...\n`);

  try {
    // Invoke the compiler directly rather than through npx: no shell, so no
    // argument-escaping surprises on any platform.
    execFileSync(
      process.execPath,
      [
        require.resolve("typescript/bin/tsc"),
        "--noEmit", "--jsx", "react-jsx", "--strict", "--skipLibCheck",
        "--moduleResolution", "bundler", "--module", "esnext", "--target", "es2022",
        "--lib", "es2022,dom,dom.iterable", "--resolveJsonModule", entry,
      ],
      { stdio: "inherit" },
    );
    console.log("No type errors.");
  } catch {
    console.error("\nType errors above. Each one is a prop or import the");
    console.error("generated app uses that the scaffold does not provide.");
    process.exitCode = 1;
  } finally {
    rmSync(OUT, { recursive: true, force: true });
  }
}

main();
