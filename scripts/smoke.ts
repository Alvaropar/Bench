/**
 * End-to-end check of the phase-1 data spine against a real database.
 *
 *   npm run smoke
 *
 * Exercises the parts that are easy to get quietly wrong: schema-derived
 * validation, partial updates, project scoping, and the claim that records
 * survive a version rewrite.
 */
import "./load-env";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { projects } from "../src/db/schema";
import {
  authorizeProject,
  commitVersion,
  createProject,
  getCurrentVersion,
  ownedProject,
  setPublished,
} from "../src/lib/projects";
import {
  countByCollection,
  createRecord,
  deleteRecord,
  listRecords,
  seedRecords,
  updateRecord,
} from "../src/lib/records";
import { appSchemaSchema } from "../src/lib/schema-validation";
import type { AppSchema } from "../src/lib/types";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}`);
    if (detail !== undefined) console.log("       ", detail);
  }
}

async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, "expected a rejection, got success");
  } catch (error) {
    check(label, true);
    return error;
  }
}

const CRM_SCHEMA: AppSchema = {
  collections: [
    {
      name: "customers",
      label: "Customers",
      fields: [
        { name: "company", label: "Company", type: "text", required: true },
        { name: "value", label: "Deal value", type: "number" },
        {
          name: "stage",
          label: "Stage",
          type: "select",
          options: ["Lead", "Demo", "Won", "Lost"],
          required: true,
        },
        { name: "contactEmail", label: "Contact", type: "email" },
        { name: "active", label: "Active", type: "boolean" },
      ],
    },
  ],
};

async function main() {
  const sessionId = crypto.randomUUID();
  console.log("\nBench data spine smoke test\n");

  console.log("AppSchema validation");
  check("valid schema accepted", appSchemaSchema.safeParse(CRM_SCHEMA).success);
  check(
    "snake_case collection name rejected",
    !appSchemaSchema.safeParse({
      collections: [{ name: "my_things", label: "X", fields: CRM_SCHEMA.collections[0].fields }],
    }).success,
  );

  console.log("\nProject lifecycle");
  const { project } = await createProject({ title: "Sales CRM", sessionId });
  check("project created with a slug", /^sales-crm-[a-z0-9]{6}$/.test(project.slug), project.slug);
  check("starts on an empty version", Boolean(project.currentVersionId));

  const version = await commitVersion({
    projectId: project.id,
    parentId: project.currentVersionId,
    files: { "App.tsx": "// generated" },
    appSchema: CRM_SCHEMA,
    label: "initial generation",
  });
  const current = await getCurrentVersion((await getDb()
    .select()
    .from(projects)
    .where(eq(projects.id, project.id))
    .limit(1))[0]);
  check("commit advances currentVersionId", current?.id === version.id);

  console.log("\nRecord validation");
  const record = await createRecord({
    projectId: project.id,
    collection: "customers",
    schema: CRM_SCHEMA,
    data: { company: "Acme Corp", value: "120000", stage: "Won", active: true },
  });
  check("record created", Boolean(record.id));
  check("number field coerced from string", record.value === 120000, record.value);
  check("omitted optional field absent", record.contactEmail === undefined);

  await expectThrow("missing required field rejected", () =>
    createRecord({
      projectId: project.id,
      collection: "customers",
      schema: CRM_SCHEMA,
      data: { value: 1 },
    }),
  );

  const enumError = await expectThrow("value outside select options rejected", () =>
    createRecord({
      projectId: project.id,
      collection: "customers",
      schema: CRM_SCHEMA,
      data: { company: "X", stage: "Nonsense" },
    }),
  );
  check(
    "rejection names the offending field",
    JSON.stringify((enumError as { details?: unknown })?.details ?? "").includes("stage"),
    (enumError as { details?: unknown })?.details,
  );

  await expectThrow("undeclared field rejected", () =>
    createRecord({
      projectId: project.id,
      collection: "customers",
      schema: CRM_SCHEMA,
      data: { company: "X", stage: "Lead", madeUpField: 1 },
    }),
  );

  await expectThrow("unknown collection rejected", () =>
    createRecord({
      projectId: project.id,
      collection: "invoices",
      schema: CRM_SCHEMA,
      data: { company: "X" },
    }),
  );

  console.log("\nUpdates and seeding");
  const updated = await updateRecord({
    projectId: project.id,
    collection: "customers",
    recordId: record.id,
    schema: CRM_SCHEMA,
    data: { stage: "Lost" },
  });
  check("partial update applies", updated.stage === "Lost");
  check("partial update preserves other fields", updated.company === "Acme Corp");

  const seeded = await seedRecords({
    projectId: project.id,
    collection: "customers",
    schema: CRM_SCHEMA,
    rows: [
      { company: "Tesla", value: 80000, stage: "Lead" },
      { company: "Microsoft", value: 50000, stage: "Demo" },
    ],
  });
  check("seed inserts rows", seeded === 2, seeded);

  const listed = await listRecords({ projectId: project.id, collection: "customers" });
  check("list returns everything", listed.length === 3, listed.length);
  const counts = await countByCollection(project.id);
  check("counts by collection", counts.customers === 3, counts);

  console.log("\nData outlives code");
  await commitVersion({
    projectId: project.id,
    parentId: version.id,
    files: { "App.tsx": "// completely rewritten" },
    appSchema: CRM_SCHEMA,
    label: "rewrite",
  });
  const afterRewrite = await listRecords({ projectId: project.id, collection: "customers" });
  check("records survive a version rewrite", afterRewrite.length === 3, afterRewrite.length);

  console.log("\nPublishing");
  const stranger = crypto.randomUUID();

  await expectThrow("a stranger cannot reach an unpublished project", () =>
    authorizeProject(project.id, stranger),
  );

  await setPublished(project.id, true);
  const reached = await authorizeProject(project.id, stranger);
  check("publishing opens the project to anyone", reached.id === project.id);
  check(
    "a published app is readable by a stranger",
    (await listRecords({ projectId: project.id, collection: "customers" })).length > 0,
  );

  // Publishing shares the data, never the source: only the owner may run the
  // agent or flip the flag back.
  await expectThrow("a stranger still cannot act as the owner", () =>
    ownedProject(project.id, stranger),
  );

  await setPublished(project.id, false);
  await expectThrow("unpublishing revokes the stranger again", () =>
    authorizeProject(project.id, stranger),
  );

  console.log("\nIsolation");
  const other = await createProject({ title: "Other app", sessionId: crypto.randomUUID() });
  const otherRecords = await listRecords({
    projectId: other.project.id,
    collection: "customers",
  });
  check("another project sees none of it", otherRecords.length === 0);

  await deleteRecord({ projectId: project.id, recordId: record.id });
  check(
    "delete removes one row",
    (await listRecords({ projectId: project.id, collection: "customers" })).length === 2,
  );

  // Cascades clean up versions, messages and records.
  const db = getDb();
  await db.delete(projects).where(eq(projects.id, project.id));
  await db.delete(projects).where(eq(projects.id, other.project.id));
  check(
    "cascade delete clears records",
    (await listRecords({ projectId: project.id, collection: "customers" })).length === 0,
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nSmoke test crashed:", error);
  process.exit(1);
});
