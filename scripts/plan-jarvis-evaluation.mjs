import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function argument(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function loadPolicy() {
  const source = fs.readFileSync(path.resolve("src/lib/jarvis/evaluation-profile.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports });
  return module.exports;
}

const explicitPaths = argument("paths")
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const base = argument("base") || "HEAD^";
const head = argument("head") || "HEAD";
const changedPaths = explicitPaths ?? execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
  encoding: "utf8",
}).split(/\r?\n/).filter(Boolean);

const { planJarvisEvaluation, JARVIS_SMOKE_EVALUATION_IDS } = loadPolicy();
const plan = planJarvisEvaluation(changedPaths);
const categoryArgument = plan.profile === "targeted" && plan.categories.length ? ` --categories=${plan.categories.join(",")}` : "";
const result = {
  ...plan,
  changedPaths,
  smokeCaseCount: JARVIS_SMOKE_EVALUATION_IDS.length,
  suggestedCommand: `node --env-file=.env scripts/qa-jarvis-live-corpus.mjs --profile=${plan.profile}${categoryArgument}`,
  safety: "Live-Datenbank nicht verwenden; gegen eine isoliert restaurierte QA-Datenbank ausführen.",
};

console.log(JSON.stringify(result, null, 2));
