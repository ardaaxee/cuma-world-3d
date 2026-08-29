#!/usr/bin/env node
/**
 * Contract tests for the Milestone 05 mission graph, save migration and
 * per-run routine variation.
 *
 * `mission.ts` deliberately depends only on the DOM and localStorage, so it can
 * be compiled with the TypeScript already in devDependencies and exercised
 * under plain Node against a small shim. No test framework, no new dependency.
 *
 *   node ci/test_mission_graph.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCES = [
  "src/game/mission.ts",
  "src/game/mission-graph.ts",
  "src/game/mission-save.ts",
  "src/game/mission-result.ts",
  "src/game/npc-routines.ts",
  "src/game/run-variation.ts",
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
  const outDir = mkdtempSync(join(tmpdir(), "cuma-mission-"));
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", ...SOURCES, "--outDir", outDir, "--module", "esnext", "--target", "es2022",
      "--moduleResolution", "bundler", "--skipLibCheck", "--strict", "--lib", "ES2022,DOM"],
    { stdio: "inherit", cwd: resolve(".") },
  );
  for (const file of readdirSync(outDir)) {
    if (!file.endsWith(".js")) continue;
    const path = join(outDir, file);
    const patched = readFileSync(path, "utf8").replace(
      /(from\s+")(\.\/[^"]+?)(")/g,
      (match, head, specifier, tail) => (specifier.endsWith(".js") ? match : `${head}${specifier}.js${tail}`),
    );
    writeFileSync(path, patched);
  }
  return outDir;
}

/** Minimal DOM + storage shim: the mission director touches nothing else. */
function installDomShim() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
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
  globalThis.document = {
    body: { dataset: {} },
    querySelector: () => null,
  };
  return { store, reset: () => store.clear() };
}

const shim = installDomShim();
const outDir = compile();
const load = (name) => import(pathToFileURL(join(outDir, name)).href);

let MissionDirector;
let graph;
let save;
let routines;
let variation;
let missionResult;

try {
  ({ MissionDirector } = await load("mission.js"));
  graph = await load("mission-graph.js");
  save = await load("mission-save.js");
  routines = await load("npc-routines.js");
  variation = await load("run-variation.js");
  missionResult = await load("mission-result.js");

  runTests();
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

function fresh() {
  shim.reset();
  document.body.dataset = {};
  return new MissionDirector();
}

/** Drives a director to the point where infiltration has begun. */
function infiltrating(intel = []) {
  const director = fresh();
  director.acknowledgeBriefing();
  director.discoverIntel("market_front_access");
  director.discoverIntel("market_side_access");
  for (const id of intel) director.discoverIntel(id);
  director.chooseRoute("main");
  return director;
}

function runTests() {
  console.log("\n--- required order and the original path ---");
  {
    const director = infiltrating();
    eq("a fresh infiltration starts at ACCESS", director.snapshot().operationStep, "ACCESS");
    ok("MANIFEST cannot be solved before ACCESS", !director.canResolve("manifest_records"));
    ok("VERIFY cannot be solved before MANIFEST", !director.canResolve("verify_counter"));

    ok("ACCESS resolves", director.resolveStage("access_terminal"));
    eq("step advances to MANIFEST", director.snapshot().operationStep, "MANIFEST");
    eq("operationStep signal stays compatible", document.body.dataset.operationStep, "manifest");

    ok("records MANIFEST resolves", director.resolveStage("manifest_records"));
    eq("step advances to VERIFY", director.snapshot().operationStep, "VERIFY");

    ok("counter VERIFY resolves", director.resolveStage("verify_counter"));
    eq("run moves to EXTRACT", director.snapshot().state, "EXTRACT");
    eq("step reads DONE", director.snapshot().operationStep, "DONE");
    ok("extraction is now allowed", director.canInteract("extract"));
    ok("extract completes the run", director.extract());
    eq("run is COMPLETE", director.snapshot().state, "COMPLETE");
  }

  console.log("\n--- intel gates the alternates ---");
  {
    const director = infiltrating();
    director.resolveStage("access_terminal");
    ok("ledger MANIFEST is locked without worker-route intel", !director.canResolve("manifest_ledger"));
    ok("ledger resolution is refused", !director.resolveStage("manifest_ledger"));
    eq("a refused resolution does not advance the step", director.snapshot().operationStep, "MANIFEST");
  }
  {
    const director = infiltrating(["market_worker_route"]);
    director.resolveStage("access_terminal");
    ok("ledger MANIFEST unlocks with worker-route intel", director.canResolve("manifest_ledger"));
    ok("ledger MANIFEST resolves", director.resolveStage("manifest_ledger"));
    eq("step advances to VERIFY", director.snapshot().operationStep, "VERIFY");
    ok("monitoring VERIFY is locked without camera intel", !director.canResolve("verify_monitoring"));
  }
  {
    const director = infiltrating(["market_camera"]);
    director.resolveStage("access_terminal");
    director.resolveStage("manifest_records");
    ok("monitoring VERIFY unlocks with camera intel", director.canResolve("verify_monitoring"));
    ok("monitoring VERIFY resolves", director.resolveStage("verify_monitoring"));
    eq("run moves to EXTRACT", director.snapshot().state, "EXTRACT");
  }

  console.log("\n--- a stage can never be completed twice ---");
  {
    const director = infiltrating(["market_worker_route", "market_camera"]);
    director.resolveStage("access_terminal");
    ok("records MANIFEST resolves first", director.resolveStage("manifest_records"));
    ok("the ledger alternate can no longer resolve MANIFEST", !director.canResolve("manifest_ledger"));
    ok("the ledger alternate is refused", !director.resolveStage("manifest_ledger"));
    eq("MANIFEST keeps its original resolution", director.resolutionFor("MANIFEST"), "manifest_records");
    eq("the step did not skip ahead", director.snapshot().operationStep, "VERIFY");

    ok("monitoring VERIFY resolves first", director.resolveStage("verify_monitoring"));
    ok("the counter alternate is refused", !director.resolveStage("verify_counter"));
    ok("completeObjective() cannot re-complete VERIFY", !director.completeObjective());
    eq("VERIFY keeps its original resolution", director.resolutionFor("VERIFY"), "verify_monitoring");
    eq("state is EXTRACT exactly once", director.snapshot().state, "EXTRACT");
  }
  {
    // The same resolution replayed must also be refused.
    const director = infiltrating();
    director.resolveStage("access_terminal");
    ok("re-running the same resolution is refused", !director.resolveStage("access_terminal"));
    eq("step stays at MANIFEST", director.snapshot().operationStep, "MANIFEST");
  }

  console.log("\n--- optional objectives never block extraction ---");
  {
    const director = infiltrating();
    director.resolveStage("access_terminal");
    director.resolveStage("manifest_records");
    director.resolveStage("verify_counter");
    eq("no optional objective completed", director.snapshot().objectivesCompleted, 0);
    ok("extraction is still allowed", director.canInteract("extract"));
    ok("mission completes with 0/2", director.extract());
  }
  {
    const director = infiltrating();
    director.resolveStage("access_terminal");
    ok("secondary records completes", director.completeOptionalObjective("secondary_records"));
    ok("it cannot be completed twice", !director.completeOptionalObjective("secondary_records"));
    ok("shift pattern completes", director.completeOptionalObjective("shift_pattern"));
    eq("both are counted", director.snapshot().objectivesCompleted, 2);
    eq("objective total is exactly two", director.snapshot().objectivesTotal, 2);
  }

  console.log("\n--- opportunity gating ---");
  {
    const director = infiltrating();
    director.resolveStage("access_terminal");
    ok("routine window is locked without the shift pattern", !director.canUseOpportunity("staff_routine_window"));
    director.completeOptionalObjective("shift_pattern");
    ok("shift pattern unlocks the routine window", director.canUseOpportunity("staff_routine_window"));
    ok("routine window is used", director.useOpportunity("staff_routine_window"));
    ok("routine window is one-shot", !director.canUseOpportunity("staff_routine_window"));

    ok("cart is locked without worker-route intel", !director.canUseOpportunity("delivery_cart"));
    ok("camera bypass is locked without camera intel", !director.canUseOpportunity("camera_bypass"));
  }

  console.log("\n--- old save migration ---");
  {
    // A pre-Milestone-05 save: only operationStep, no resolutions or seed.
    shim.reset();
    document.body.dataset = {};
    localStorage.setItem("cuma_world_android_save_v100", JSON.stringify({
      state: "INFILTRATE",
      intel: ["market_front_access", "market_side_access"],
      selectedRoute: "main",
      alerts: 1,
      operationStep: "VERIFY",
    }));
    const director = new MissionDirector();
    eq("legacy state is preserved", director.snapshot().state, "INFILTRATE");
    eq("legacy step is preserved", director.snapshot().operationStep, "VERIFY");
    ok("ACCESS is backfilled", director.isStageResolved("ACCESS"));
    ok("MANIFEST is backfilled", director.isStageResolved("MANIFEST"));
    ok("VERIFY is still open", !director.isStageResolved("VERIFY"));
    ok("a run seed is generated for the old save", director.getRunSeed() > 0);
    ok("the legacy run is still completable", director.resolveStage("verify_counter"));
    ok("and can still extract", director.extract());
    eq("legacy alerts survive into the rank", director.snapshot().rank, "SHADOW");
  }
  {
    // An already-COMPLETE legacy save must still yield a usable debrief.
    shim.reset();
    document.body.dataset = {};
    localStorage.setItem("cuma_world_android_save_v100", JSON.stringify({
      state: "COMPLETE",
      intel: ["market_front_access", "market_side_access", "market_camera"],
      selectedRoute: "side",
      alerts: 0,
      operationStep: "DONE",
    }));
    let published = null;
    const stop = missionResult.onMissionResult((result) => { published = result; });
    const director = new MissionDirector();
    stop();
    ok("a completed legacy save publishes a result", published !== null);
    eq("rank is derived", published?.rank, "GHOST");
    eq("route survives", published?.route, "side");
    eq("all three stages are reported", published?.resolutions.length, 3);
    eq("stage resolutions are the legacy ones", published?.resolutions[1]?.resolution, "manifest_records");
    ok("a replay hint is present", typeof published?.replayHint === "string" && published.replayHint.length > 0);
    eq("director agrees the run is complete", director.snapshot().state, "COMPLETE");
  }
  {
    // Garbage must not crash the director.
    shim.reset();
    document.body.dataset = {};
    localStorage.setItem("cuma_world_android_save_v100", "{not json");
    const director = new MissionDirector();
    eq("a corrupt save falls back to BRIEFING", director.snapshot().state, "BRIEFING");
    ok("a seed is still available", director.getRunSeed() > 0);
  }
  {
    shim.reset();
    document.body.dataset = {};
    localStorage.setItem("cuma_world_android_save_v100", JSON.stringify({
      state: "INFILTRATE",
      intel: ["market_front_access", "nonsense_intel"],
      selectedRoute: "main",
      alerts: 0,
      resolutions: { ACCESS: "verify_counter", MANIFEST: "not_a_resolution" },
      objectives: ["not_an_objective"],
      opportunities: ["not_an_opportunity"],
    }));
    const director = new MissionDirector();
    ok("a resolution stored under the wrong stage is rejected", !director.isStageResolved("ACCESS"));
    ok("an unknown resolution id is rejected", !director.isStageResolved("MANIFEST"));
    eq("unknown objectives are dropped", director.snapshot().objectivesCompleted, 0);
    eq("unknown opportunities are dropped", director.snapshot().opportunitiesUsed, 0);
    eq("unknown intel is dropped", director.snapshot().intelFound, 1);
  }

  console.log("\n--- run seed and replay ---");
  {
    const director = infiltrating();
    const seed = director.getRunSeed();
    ok("a seed is generated", seed > 0);
    // Reloading the same save must reproduce it.
    const resumed = new MissionDirector();
    eq("resuming the same save keeps the seed", resumed.getRunSeed(), seed);

    // Replay clears the save; the next run seeds afresh.
    save.resetMissionProgress();
    const replayed = new MissionDirector();
    ok("replay produces a new seed", replayed.getRunSeed() > 0);
    eq("replay clears mission progress", replayed.snapshot().state, "BRIEFING");
    eq("replay clears the route signal", document.body.dataset.route, "none");
  }
  {
    // Seeds differ across runs often enough for variation to be real.
    const seeds = new Set();
    for (let index = 0; index < 200; index += 1) seeds.add(save.createRunSeed());
    ok("fresh seeds vary", seeds.size > 190, `distinct=${seeds.size}/200`);
    ok("no seed is zero", ![...seeds].includes(0));
  }

  console.log("\n--- routine variation is deterministic ---");
  {
    const set = routines.ROUTINE_SETS["GÜVENLİK 01"];
    ok("security 01 has at least two authored variants", set.variants.length >= 2, `variants=${set.variants.length}`);
    ok("security 02 has at least two authored variants", routines.ROUTINE_SETS["GÜVENLİK 02"].variants.length >= 2);
    ok("the worker has an alternate routine", Boolean(routines.ROUTINE_SETS["MARKET ÇALIŞANI"].alternate));

    const seed = 123456789;
    const first = routines.selectVariant(set, seed, "GÜVENLİK 01").id;
    const again = routines.selectVariant(set, seed, "GÜVENLİK 01").id;
    eq("the same seed picks the same variant", first, again);
    eq("dwell scale is stable for a seed", routines.selectDwellScale(seed, "G"), routines.selectDwellScale(seed, "G"));

    // Different agents must not move in lockstep.
    const a = routines.selectDwellScale(seed, "GÜVENLİK 01");
    const b = routines.selectDwellScale(seed, "GÜVENLİK 02");
    ok("different agents get different dwell scales", Math.abs(a - b) > 1e-6, `a=${a.toFixed(4)} b=${b.toFixed(4)}`);
    ok("dwell scale stays in range", a > 0.7 && a < 1.4 && b > 0.7 && b < 1.4);

    // Across many seeds every authored variant must actually get used.
    const chosen = new Set();
    for (let seedValue = 1; seedValue <= 400; seedValue += 1) {
      chosen.add(routines.selectVariant(set, seedValue, "GÜVENLİK 01").id);
    }
    eq("every authored variant is reachable", chosen.size, set.variants.length);
  }
  {
    // The variation helpers must be pure: no Math.random anywhere.
    eq("seededUnit is deterministic", variation.seededUnit(42, "x"), variation.seededUnit(42, "x"));
    ok("seededUnit stays in [0,1)", (() => {
      for (let index = 0; index < 500; index += 1) {
        const value = variation.seededUnit(index * 7919 + 1, `s${index}`);
        if (!(value >= 0 && value < 1)) return false;
      }
      return true;
    })());
    ok("seededIndex stays in range", (() => {
      for (let index = 0; index < 500; index += 1) {
        const value = variation.seededIndex(index * 104729 + 1, `s${index}`, 3);
        if (!Number.isInteger(value) || value < 0 || value > 2) return false;
      }
      return true;
    })());
  }

  console.log("\n--- scoring ---");
  {
    const clean = infiltrating(["market_worker_route", "market_camera"]);
    clean.resolveStage("access_terminal");
    clean.resolveStage("manifest_records");
    clean.completeOptionalObjective("secondary_records");
    clean.completeOptionalObjective("shift_pattern");
    clean.resolveStage("verify_counter");
    clean.extract();
    const full = clean.snapshot();
    eq("a clean full run ranks GHOST", full.rank, "GHOST");
    ok("score stays within bounds", full.score >= 0 && full.score <= 100, `score=${full.score}`);

    // The alternate resolution must not be worth more than the original.
    const viaAlternates = infiltrating(["market_worker_route", "market_camera"]);
    viaAlternates.resolveStage("access_terminal");
    viaAlternates.resolveStage("manifest_ledger");
    viaAlternates.completeOptionalObjective("secondary_records");
    viaAlternates.completeOptionalObjective("shift_pattern");
    viaAlternates.resolveStage("verify_monitoring");
    viaAlternates.extract();
    eq("alternate resolutions score identically", viaAlternates.snapshot().score, full.score);

    const noisy = infiltrating();
    noisy.resolveStage("access_terminal");
    for (let index = 0; index < 6; index += 1) noisy.reportAlert();
    noisy.resolveStage("manifest_records");
    noisy.resolveStage("verify_counter");
    noisy.extract();
    eq("many alerts rank OPERATIVE", noisy.snapshot().rank, "OPERATIVE");
    ok("score never goes negative", noisy.snapshot().score >= 0, `score=${noisy.snapshot().score}`);
  }

  console.log("\n--- typed mission result ---");
  {
    let published = null;
    const stop = missionResult.onMissionResult((result) => { published = result; });
    const director = infiltrating(["market_worker_route"]);
    director.resolveStage("access_terminal");
    director.resolveStage("manifest_ledger");
    director.completeOptionalObjective("shift_pattern");
    director.useOpportunity("staff_routine_window");
    director.resolveStage("verify_counter");
    director.extract();
    stop();

    ok("a result is published on completion", published !== null);
    eq("route is typed", published?.route, "main");
    eq("resolutions are reported per stage", published?.resolutions.length, 3);
    eq("the ledger resolution is recorded", published?.resolutions[1]?.resolution, "manifest_ledger");
    ok("the resolution carries a human label", (published?.resolutions[1]?.label ?? "").length > 0);
    eq("objective count is reported", published?.objectivesCompleted.length, 1);
    eq("objective total is reported", published?.objectivesTotal, 2);
    eq("opportunities are reported", published?.opportunitiesUsed.length, 1);
    eq("alerts are reported", published?.alerts, 0);
    ok("the seed is carried for reference", (published?.runSeed ?? 0) > 0);
    ok("the replay hint names the unused alternate", (published?.replayHint ?? "").includes("ARKA OFİS"),
      `hint=${published?.replayHint}`);
  }

  console.log("\n--- graph helpers ---");
  {
    eq("three required stages", graph.STAGE_ORDER.length, 3);
    eq("exactly two optional objectives", graph.allOptionalObjectiveIds().length, 2);
    eq("three opportunities", graph.allOpportunityIds().length, 3);
    eq("MANIFEST has two resolutions", graph.resolutionsForStage("MANIFEST").length, 2);
    eq("VERIFY has two resolutions", graph.resolutionsForStage("VERIFY").length, 2);
    eq("ACCESS has one resolution", graph.resolutionsForStage("ACCESS").length, 1);
    eq("an empty run blocks on ACCESS", graph.firstBlockingStage(new Set()), "ACCESS");
    eq("a full run blocks on nothing", graph.firstBlockingStage(new Set(["ACCESS", "MANIFEST", "VERIFY"])), null);
    eq("legacy DONE implies all stages", graph.stagesImpliedByStep("DONE").length, 3);
    eq("legacy VERIFY implies two stages", graph.stagesImpliedByStep("VERIFY").length, 2);
  }

  console.log(
    failures === 0
      ? `\nMISSION_GRAPH_OK ${checks} checks passed`
      : `\nMISSION_GRAPH_FAILED ${failures} of ${checks} checks failed`,
  );
  process.exit(failures === 0 ? 0 : 1);
}
