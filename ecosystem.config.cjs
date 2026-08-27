"use strict";

const fs = require("fs");
const path = require("path");

const AGENTS = ["healthfactor", "rebalancing", "gridtrading", "yieldrouter"];

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function app(name) {
  const root = path.join(__dirname, "agents", name);
  const envFile = path.join(root, ".env");
  if (!fs.existsSync(envFile)) return null;
  return {
    name,
    cwd: path.join(root, "app/agent"),
    script: "dist/unifiedMain.js",
    env: loadEnv(envFile),
  };
}

module.exports = {
  apps: AGENTS.map(app).filter(Boolean),
};
