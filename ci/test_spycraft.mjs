#!/usr/bin/env node
/**
 * Dependency-light Spycraft 2.0 contract tests.
 *
 * The models in this milestone are intentionally free of Babylon and DOM
 * dependencies. Compile them with the repository TypeScript toolchain, then
 * exercise the authored rules under plain Node.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCES = [
  "src/game/field-instinct.ts",
  "src/game/social-stealth.ts",
  "src/game/observation-intel.ts",
  "src/game/spycraft-events.ts",
  "src/game/spycraft.ts",
  "src/game/mission-graph.ts",
];

let failures = 0;
let checks = 0;
function ok(label, condition, note = "") {
  checks += 1;
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${note ? ` — ${note}` : ""}`);
}
function eq(label, got, want) {
  ok(label, got === want, `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
}

function compile() {
  const outDir = mkdtempSync(join(tmpdir(), "cuma-spycraft-"));
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", ...SOURCES, "--outDir", outDir, "--module", "esnext", "--target", "es2022",
      "--moduleResolution", "bundler", "--skipLibCheck", "--strict", "--lib", "ES2022,DOM"],
    { stdio: "inherit", cwd: resolve(".") },
  );
  for (const file of readdirSync(outDir)) {
    if (!file.endsWith(".js")) continue;
    const path = join(outDir, file);
    writeFileSync(path, readFileSync(path, "utf8").replace(
      /(from\s+")(\.\/[^"]+?)(")/g,
      (match, head, specifier, tail) => (specifier.endsWith(".js") ? match : `${head}${specifier}.js${tail}`),
    ));
  }
  return outDir;
}

const listeners = new Map();
globalThis.window = {
  addEventListener: (type, handler) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(handler);
  },
  removeEventListener: (type, handler) => {
    const list = listeners.get(type) ?? [];
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  },
  dispatchEvent: (event) => {
    for (const handler of [...(listeners.get(event.type) ?? [])]) handler(event);
    return true;
  },
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

const outDir = compile();
try {
  const field = await import(pathToFileURL(join(outDir, "field-instinct.js")).href);
  const observations = await import(pathToFileURL(join(outDir, "observation-intel.js")).href);
  const social = await import(pathToFileURL(join(outDir, "social-stealth.js")).href);
  const spycraft = await import(pathToFileURL(join(outDir, "spycraft.js")).href);
  const events = await import(pathToFileURL(join(outDir, "spycraft-events.js")).href);

  console.log("\n--- authored facts and event contract ---");
  eq("exactly four authored facts", spycraft.allSpycraftFactIds().length, 4);
  for (const fact of ["staff_break_window", "delivery_rotation", "monitoring_shift_gap", "service_access_pattern"]) {
    ok(`${fact} is valid`, spycraft.isSpycraftFactId(fact));
  }
  ok("unknown facts are rejected", !spycraft.isSpycraftFactId("secret_wallhack"));
  const received = [];
  const stop = events.onSpycraftEvent((event) => received.push(event));
  const state = new spycraft.SpycraftState();
  ok("first fact discovery succeeds", state.discoverFact("staff_break_window"));
  ok("duplicate fact discovery is prevented", !state.discoverFact("staff_break_window"));
  eq("fact event is emitted once", received.filter((event) => event.kind === "intel-discovered").length, 1);
  eq("staff fact maps to routine opportunity", spycraft.opportunityForFact("staff_break_window"), "staff_routine_window");
  eq("delivery fact maps to existing cart opportunity", spycraft.opportunityForFact("delivery_rotation"), "delivery_cart");
  eq("camera-gap fact maps to existing bypass opportunity", spycraft.opportunityForFact("monitoring_shift_gap"), "camera_bypass");
  eq("service fact maps to existing manifest resolution", spycraft.opportunityForFact("service_access_pattern"), "manifest_ledger");
  eq("opportunity unlock event is emitted", received.filter((event) => event.kind === "opportunity-unlocked").length, 1);
  stop();

  console.log("\n--- authored observation eligibility ---");
  const node = observations.OBSERVATION_NODES[0];
  const viewer = { x: -2.8, y: 1.1, z: 3.2 };
  const facing = { ...viewer, forwardX: 0, forwardY: 0, forwardZ: 1 };
  ok("in-range facing observation is eligible", observations.observationEligibility(node, viewer, facing, true).eligible);
  ok("range is enforced", observations.observationEligibility(node, { ...viewer, z: -30 }, facing, true).reason === "out-of-range");
  ok("facing is enforced", observations.observationEligibility(node, viewer, { ...viewer, forwardX: 1, forwardY: 0, forwardZ: 0 }, true).reason === "wrong-facing");
  ok("wall occlusion is enforced", observations.observationEligibility(node, viewer, facing, false).reason === "occluded");
  let progress = observations.advanceObservationProgress({ nodeId: null, seconds: 0 }, node.id, 0.4, true, node.duration);
  ok("observation progress advances", progress.seconds > 0 && !progress.discovered);
  const held = observations.advanceObservationProgress(progress, node.id, 0.2, false, node.duration);
  eq("lost eligibility pauses progress", held.seconds, progress.seconds);
  let completed = held;
  for (let i = 0; i < 4; i += 1) {
    completed = observations.advanceObservationProgress(completed, node.id, 0.25, true, node.duration);
  }
  ok("authored duration discovers the fact", completed.discovered);
  eq("observation reset clears target", observations.resetObservationProgress().nodeId, null);

  console.log("\n--- field instinct bounds, spend, recovery ---");
  const instinct = new field.FieldInstinct(99);
  eq("resource clamps at max", instinct.remaining, field.FIELD_INSTINCT_MAX);
  ok("spend is explicit", instinct.spend());
  eq("one spend costs one", instinct.remaining, 2);
  ok("overspend is refused", !instinct.spend(4));
  instinct.recover(99);
  eq("recovery clamps at max", instinct.remaining, 3);
  instinct.restore(-4);
  eq("restore clamps low", instinct.remaining, 0);
  instinct.reset();
  eq("reset returns the authored start", instinct.remaining, field.FIELD_INSTINCT_START);
  ok("high alert blocks Field Instinct spending", !state.canSpendFieldInstinct("HIGH_ALERT"));

  console.log("\n--- social pressure and deterministic bluff ---");
  const pressure = social.socialPressure({
    zone: "STAFF", speed: 0, running: true, erraticMotion: true,
    controlledDoorApproach: true, guardedAreaLingering: false,
  });
  ok("social pressure is bounded", pressure.pressure >= 0 && pressure.pressure <= 1);
  ok("staff lingering contributes pressure", pressure.reason !== "none");
  const recovery = social.socialPressure({
    zone: "PUBLIC", speed: 1, running: false, erraticMotion: false,
    controlledDoorApproach: false, guardedAreaLingering: false,
  });
  ok("public context supplies recovery", recovery.recovery > 0);
  const bluffContext = {
    facilityState: "WATCH", zone: "STAFF", hasStaffCredential: true,
    knowsStaffBreakWindow: true, targetId: "GÜVENLİK 01", targetAwareness: 0.4,
    recentContact: true, crouched: false, inCover: false, running: false, noise: 0.1,
  };
  const firstBluff = social.resolveBluff(1234, bluffContext);
  eq("same seed and context give same bluff", social.resolveBluff(1234, bluffContext).accepted, firstBluff.accepted);
  ok("bluff is eligible only in context", firstBluff.eligible);
  ok("bluff relief is bounded", firstBluff.relief >= 0 && firstBluff.relief <= 0.34);
  ok("high alert blocks bluff", !social.resolveBluff(1234, { ...bluffContext, facilityState: "HIGH_ALERT" }).eligible);
  ok("bluff cannot erase an alert", social.resolveBluff(1234, bluffContext).relief < 1);
  ok("no progression score exists in spycraft summary", !("score" in state.summary()));
  const focusHints = [
    { factId: "staff_break_window", label: "routine" },
    { factId: "delivery_rotation", label: "cart" },
  ];
  ok("FIELD FOCUS filters unknown facts", spycraft.knownFocusHints(
    new Set(["staff_break_window"]), focusHints,
  ).length === 1);

  console.log("\n--- save restore, known-only focus, determinism ---");
  for (const fact of ["delivery_rotation", "monitoring_shift_gap", "service_access_pattern"]) state.discoverFact(fact);
  const stored = state.serialize();
  const restored = new spycraft.SpycraftState();
  restored.restore(stored);
  eq("all discovered facts restore", restored.summary().facts.length, 4);
  eq("Field Instinct restores", restored.summary().fieldInstinctRemaining, state.summary().fieldInstinctRemaining);
  eq("known opportunity list is deterministic", restored.summary().knownOpportunities.join(","), state.summary().knownOpportunities.join(","));
  ok("unknown focus facts do not enter known list", !restored.summary().facts.includes("unknown"));
  const replayA = restored.summary().knownOpportunities.join("|");
  const replayB = new spycraft.SpycraftState();
  replayB.restore(stored);
  eq("replay hint input is stable across restore", replayB.summary().knownOpportunities.join("|"), replayA);
  ok("old saves can omit Spycraft state", (() => {
    const legacy = new spycraft.SpycraftState();
    legacy.restore(undefined);
    return legacy.summary().facts.length === 0 && legacy.summary().fieldInstinctRemaining === field.FIELD_INSTINCT_START;
  })());
  const saveSource = readFileSync(resolve("src/game/mission-save.ts"), "utf8");
  const resultSource = readFileSync(resolve("src/game/mission-result.ts"), "utf8");
  const runtimeSource = readFileSync(resolve("src/game/runtime11.ts"), "utf8");
  const spycraftSource = readFileSync(resolve("src/game/spycraft.ts"), "utf8");
  ok("mission save keeps Spycraft state optional", saveSource.includes("spycraft?: StoredSpycraft"));
  ok("MissionResult keeps Spycraft additions optional", resultSource.includes("spycraftFacts?:"));
  ok("runtime Field Focus uses the known-fact gate", runtimeSource.includes("hasSpycraftFact(node.factId)"));
  ok("Spycraft does not add a progression buff", !spycraftSource.includes("score") && !spycraftSource.includes("setMovement"));
  stop();
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(failures === 0 ? `\nSPYCRAFT_OK ${checks} checks passed` : `\nSPYCRAFT_FAILED ${failures} of ${checks} checks failed`);
process.exit(failures === 0 ? 0 : 1);
