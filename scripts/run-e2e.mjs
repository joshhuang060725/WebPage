import { spawn } from "node:child_process";
import process from "node:process";

const server = spawn(
  process.execPath,
  ["./node_modules/astro/astro.js", "dev", "--host", "127.0.0.1", "--port", "4321"],
  {
    cwd: process.cwd(),
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  }
);

let serverLog = "";
server.stdout.on("data", (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverLog += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Preview server exited early.\n${serverLog}`);
    try {
      const response = await fetch("http://127.0.0.1:4321/");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not become ready.\n${serverLog}`);
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const test = spawn(process.execPath, ["./node_modules/@playwright/test/cli.js", "test", "--reporter=line"], {
      cwd: process.cwd(),
      env: { ...process.env, PW_EXTERNAL_SERVER: "1" },
      stdio: "inherit",
      shell: false
    });
    test.on("error", reject);
    test.on("exit", (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await runPlaywright();
} catch (error) {
  console.error(error);
} finally {
  server.kill();
}
process.exitCode = exitCode;
