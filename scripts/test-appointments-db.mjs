import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cliEntry = resolve("node_modules/supabase/dist/supabase.js");
const windowsBinary = resolve(
  "node_modules/@supabase/cli-windows-x64/bin/supabase-go.exe",
);
const env = { ...process.env };

if (process.platform === "win32" && existsSync(windowsBinary)) {
  env.SUPABASE_CLI_BINARY_OVERRIDE = windowsBinary;
}

const result = spawnSync(
  process.execPath,
  [
    cliEntry,
    "test",
    "db",
    "supabase/tests/appointments-rpc.test.sql",
    "--local",
  ],
  { env, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
