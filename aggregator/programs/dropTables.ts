#!/usr/bin/env -S deno run --allow-net --unstable --allow-read --allow-env

// Useful for when breaking database changes are made.

import createQueryClient from "../src/app/createQueryClient.ts";
import * as env from "../src/env.ts";
import BundleTable from "../src/app/BundleTable.ts";

const queryClient = createQueryClient(() => {});

for (const tableName of [env.BUNDLE_TABLE_NAME]) {
  const table = await BundleTable.create(queryClient, tableName);
  await table.drop();
  console.log(`dropped table ${tableName}`);
}
