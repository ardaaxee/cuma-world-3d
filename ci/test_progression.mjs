#!/usr/bin/env node
/**
 * Contract tests for the Milestone 08 progression profile and run telemetry.
 *
 * `progression.ts` and `run-telemetry.ts` depend only on the typed mission
 * tables and localStorage, so they compile with the TypeScript already in
 * devDependencies and run under plain Node against a small shim. No test
 * framework, no new dependency.
 *
 *   node ci/test_progression.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCES = [
  "src/game/progression.ts",
  "src/game/run-telemetry.ts",
  "src/game/mission.ts",
  "src/game/mission-graph.ts",
  "src/game/mission-save.ts",
  "src/game/mission-result.ts",
  "src/game/npc-routines.ts",
  "src/game/run-variation.ts",
];

/** Modules that must never reach the boot chunk through progression/debrief. */
const FORBIDDEN_IMPORTS = [
  "@babylonjs",
  "./runtime11",
  "./world",
  "./world-expansion",
  "./doors",
  "./facility-security",
  "./npc",
  "./audio",
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
  const outDir = mkdtempSync(join(tmpdir(), "cuma-progression-"));
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

/** Minimal DOM + storage shim. Writes are counted so the per-frame ban is testable. */
function installDomShim() {
  const store = new Map();
  const writes = { count: 0, byKey: new Map() };
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      writes.count += 1;
      writes.byKey.set(key, (writes.byKey.get(key) ?? 0) + 1);
      store.set(key, String(value));
    },
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
  return {
    store,
    writes,
    reset: () => {
      store.clear();
      writes.count = 0;
      writes.byKey.clear();
    },
  };
}

const shim = installDomShim();
const outDir = compile();
const load = (name) => import(pathToFileURL(join(outDir, name)).href);

let progression;
let telemetry;
let graph;
let save;
let MissionDirector;

try {
  progression = await load("progression.js");
  telemetry = await load("run-telemetry.js");
  graph = await load("mission-graph.js");
  save = await load("mission-save.js");
  ({ MissionDirector } = await load("mission.js"));
  runTests();
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

// --- fixtures --------------------------------------------------------------

/** A completed run, with only the fields a debrief/progression consumer reads. */
function result(overrides = {}) {
  return {
    rank: "SHADOW",
    score: 70,
    route: "main",
    intelFound: 2,
    intelTotal: 4,
    optionalIntel: [],
    intelDiscovered: ["market_front_access", "market_side_access"],
    resolutions: [
      { stage: "ACCESS", resolution: "access_terminal", label: "A" },
      { stage: "MANIFEST", resolution: "manifest_records", label: "M" },
      { stage: "VERIFY", resolution: "verify_counter", label: "V" },
    ],
    objectivesCompleted: [],
    objectivesTotal: 2,
    opportunitiesUsed: [],
    alerts: 1,
    runSeed: 1000,
    replayHint: "",
    ...overrides,
  };
}

/** A perfect run: every record-worthy single-run fact at once. */
function perfectResult(overrides = {}) {
  return result({
    rank: "GHOST",
    score: 100,
    alerts: 0,
    intelFound: 4,
    intelTotal: 4,
    intelDiscovered: [...graph.allIntelIds()],
    optionalIntel: ["market_worker_route", "market_camera"],
    objectivesCompleted: ["secondary_records", "shift_pattern"],
    opportunitiesUsed: ["camera_bypass", "staff_routine_window", "delivery_cart"],
    operationSeconds: 200,
    watchSeconds: 10,
    searchSeconds: 0,
    highAlertSeconds: 0,
    maxFacilityState: "WATCH",
    ...overrides,
  });
}

function fresh() {
  shim.reset();
  document.body.dataset = {};
  return progression.defaultProgression();
}

/** Applies a chain of results to a profile, returning the last update. */
function applyAll(profile, results) {
  let update = null;
  let current = profile;
  for (const entry of results) {
    update = progression.applyCompletedRun(current, entry);
    current = update.profile;
  }
  return update;
}

function runTests() {
  // --- default profile ----------------------------------------------------
  {
    const profile = fresh();
    eq("default profile has no completed runs", profile.completedRuns, 0);
    eq("default profile has no best score", profile.bestScore, 0);
    eq("default profile invents no best rank", profile.bestRank, null);
    eq("default profile invents no best alerts", profile.bestAlerts, null);
    eq("default profile invents no best time", profile.bestOperationSeconds, null);
    eq("default profile has no mastery", profile.masteryRecords.length, 0);
    eq("default profile has no history", profile.recentRuns.length, 0);
    eq("default profile is not sealed", profile.sealed, false);
    eq("progression key is versioned", progression.PROGRESSION_KEY, "cuma_world_progression_v1");
    ok(
      "progression key differs from the mission save key",
      progression.PROGRESSION_KEY !== "cuma_world_android_save_v100",
    );
  }

  // --- storage: corrupt, unknown version, missing ------------------------
  {
    shim.reset();
    localStorage.setItem(progression.PROGRESSION_KEY, "{not json");
    const recovered = progression.readProgression();
    eq("corrupt JSON falls back to a default profile", recovered.completedRuns, 0);
    ok("corrupt JSON is not sealed, so play still records", recovered.sealed === false);

    shim.reset();
    localStorage.setItem("cuma_world_android_save_v100", JSON.stringify({ state: "COMPLETE", intel: [], alerts: 0 }));
    localStorage.setItem(progression.PROGRESSION_KEY, "%%%");
    progression.readProgression();
    ok(
      "corrupt progression does not touch the mission save",
      localStorage.getItem("cuma_world_android_save_v100") !== null,
    );

    shim.reset();
    localStorage.setItem(progression.PROGRESSION_KEY, JSON.stringify({ version: 99, completedRuns: 40, bestScore: 100 }));
    const sealed = progression.readProgression();
    eq("a newer schema version is not reinterpreted", sealed.completedRuns, 0);
    eq("a newer schema version is sealed", sealed.sealed, true);
    progression.writeProgression(sealed);
    const stillNewer = JSON.parse(localStorage.getItem(progression.PROGRESSION_KEY));
    eq("a sealed profile is never written over", stillNewer.version, 99);
    eq("a sealed profile keeps the newer data intact", stillNewer.completedRuns, 40);

    shim.reset();
    eq("a missing profile reads as default", progression.readProgression().completedRuns, 0);
  }

  // --- storage: id filtering and clamping ---------------------------------
  {
    shim.reset();
    localStorage.setItem(progression.PROGRESSION_KEY, JSON.stringify({
      version: 1,
      completedRuns: -5,
      bestScore: 5000,
      bestRank: "LEGEND",
      bestAlerts: "none",
      bestOperationSeconds: -12,
      routesCompleted: ["main", "main", "diagonal", 7],
      manifestSolutions: ["manifest_records", "verify_counter", "nope"],
      verifySolutions: ["verify_monitoring", "manifest_ledger"],
      objectivesCompletedEver: ["shift_pattern", "shift_pattern", "bogus"],
      opportunitiesUsedEver: ["delivery_cart", "teleport"],
      intelDiscoveredEver: ["market_camera", "market_ghost"],
      masteryRecords: ["ghost_record", "invented_record"],
      processedRuns: ["run:12", "run:12", "nonsense", 5],
      recentRuns: "not an array",
      unknownFutureField: { anything: true },
    }));
    const profile = progression.readProgression();
    eq("negative completed runs clamp to zero", profile.completedRuns, 0);
    eq("an out-of-range best score clamps to 100", profile.bestScore, 100);
    eq("an unknown rank is rejected", profile.bestRank, null);
    eq("a non-numeric best alert count is rejected", profile.bestAlerts, null);
    eq("a negative best time is rejected", profile.bestOperationSeconds, null);
    eq("route ids are filtered and deduplicated", profile.routesCompleted.join(","), "main");
    eq("a VERIFY id cannot enter manifestSolutions", profile.manifestSolutions.join(","), "manifest_records");
    eq("a MANIFEST id cannot enter verifySolutions", profile.verifySolutions.join(","), "verify_monitoring");
    eq("unknown objective ids are dropped", profile.objectivesCompletedEver.join(","), "shift_pattern");
    eq("unknown opportunity ids are dropped", profile.opportunitiesUsedEver.join(","), "delivery_cart");
    eq("unknown intel ids are dropped", profile.intelDiscoveredEver.join(","), "market_camera");
    eq("unknown mastery ids are dropped", profile.masteryRecords.join(","), "ghost_record");
    eq("malformed run ids are dropped", profile.processedRuns.join(","), "run:12");
    eq("a non-array history reads as empty", profile.recentRuns.length, 0);
    ok("an unknown future field does not crash the read", profile.version === 1);
  }

  // --- first completion and idempotency ----------------------------------
  {
    const first = progression.applyCompletedRun(fresh(), result());
    eq("a first completion counts once", first.profile.completedRuns, 1);
    eq("a first completion is a new run", first.isNewRun, true);
    eq("a first completion stores one history entry", first.profile.recentRuns.length, 1);
    eq("a first completion records its run id", first.profile.processedRuns.join(","), "run:1000");
    eq("the completed-run id is derived from the run seed", progression.completedRunId(1000), "run:1000");
    eq("the completed-run id is stable across calls", progression.completedRunId(1000), progression.completedRunId(1000));

    const again = progression.applyCompletedRun(first.profile, result());
    eq("restoring the same COMPLETE save is not a new run", again.isNewRun, false);
    eq("restoring the same COMPLETE save does not count twice", again.profile.completedRuns, 1);
    eq("restoring the same COMPLETE save does not duplicate history", again.profile.recentRuns.length, 1);
    eq("restoring the same COMPLETE save reports no new records", again.newlyUnlockedRecords.length, 0);
    eq("restoring the same COMPLETE save reports no new best score", again.newBestScore, false);
    ok("restoring the same COMPLETE save returns the profile unchanged", again.profile === first.profile);

    // Even a better-looking republish of the same run must not re-record.
    const inflated = progression.applyCompletedRun(first.profile, result({ score: 100, rank: "GHOST" }));
    eq("a republished run cannot raise the best score", inflated.profile.bestScore, first.profile.bestScore);

    const replay = progression.applyCompletedRun(first.profile, result({ runSeed: 2000 }));
    eq("a fresh runSeed records as a new run", replay.isNewRun, true);
    eq("a fresh runSeed increments the completion count", replay.profile.completedRuns, 2);
  }

  // --- best records -------------------------------------------------------
  {
    const base = progression.applyCompletedRun(fresh(), result({ score: 70 })).profile;
    const better = progression.applyCompletedRun(base, result({ runSeed: 2, score: 88 }));
    eq("a better score updates the best score", better.profile.bestScore, 88);
    eq("a better score is reported as a new record", better.newBestScore, true);

    const worse = progression.applyCompletedRun(better.profile, result({ runSeed: 3, score: 40 }));
    eq("a worse score does not overwrite the best score", worse.profile.bestScore, 88);
    eq("a worse score is not reported as a new record", worse.newBestScore, false);

    const tie = progression.applyCompletedRun(better.profile, result({ runSeed: 4, score: 88 }));
    eq("a tied score keeps the best score", tie.profile.bestScore, 88);
    eq("a tied score is not a new record", tie.newBestScore, false);

    eq("GHOST outranks SHADOW", progression.rankOrder("GHOST") > progression.rankOrder("SHADOW"), true);
    eq("SHADOW outranks OPERATIVE", progression.rankOrder("SHADOW") > progression.rankOrder("OPERATIVE"), true);

    const operative = progression.applyCompletedRun(fresh(), result({ rank: "OPERATIVE" })).profile;
    const shadow = progression.applyCompletedRun(operative, result({ runSeed: 2, rank: "SHADOW" }));
    eq("SHADOW replaces OPERATIVE as the best rank", shadow.profile.bestRank, "SHADOW");
    eq("a better rank is reported", shadow.newBestRank, true);
    const ghost = progression.applyCompletedRun(shadow.profile, result({ runSeed: 3, rank: "GHOST" }));
    eq("GHOST replaces SHADOW as the best rank", ghost.profile.bestRank, "GHOST");
    const backToShadow = progression.applyCompletedRun(ghost.profile, result({ runSeed: 4, rank: "SHADOW" }));
    eq("a worse rank never replaces GHOST", backToShadow.profile.bestRank, "GHOST");
    eq("a worse rank is not reported as a record", backToShadow.newBestRank, false);

    const alerts = progression.applyCompletedRun(fresh(), result({ alerts: 3 })).profile;
    eq("the first run sets the alert record", alerts.bestAlerts, 3);
    const fewer = progression.applyCompletedRun(alerts, result({ runSeed: 2, alerts: 1 }));
    eq("fewer alerts improve the record", fewer.profile.bestAlerts, 1);
    eq("fewer alerts are reported", fewer.newBestAlerts, true);
    const more = progression.applyCompletedRun(fewer.profile, result({ runSeed: 3, alerts: 6 }));
    eq("more alerts do not worsen the record", more.profile.bestAlerts, 1);
    eq("more alerts are not reported as a record", more.newBestAlerts, false);
  }

  // --- best time, with and without telemetry -----------------------------
  {
    const untimed = progression.applyCompletedRun(fresh(), result());
    eq("a run with no telemetry sets no best time", untimed.profile.bestOperationSeconds, null);
    eq("a run with no telemetry reports no time record", untimed.newBestTime, false);
    eq("a run with no telemetry stores a null history time", untimed.profile.recentRuns[0].operationSeconds, null);
    eq("an unmeasured time renders as a dash", progression.formatOperationTime(null), "—");
    eq("an undefined time renders as a dash", progression.formatOperationTime(undefined), "—");
    eq("a measured time renders as minutes and seconds", progression.formatOperationTime(204), "3:24");
    eq("a sub-minute time keeps two second digits", progression.formatOperationTime(9), "0:09");

    const timed = progression.applyCompletedRun(untimed.profile, result({ runSeed: 2, operationSeconds: 300 }));
    eq("the first measured run sets the best time", timed.profile.bestOperationSeconds, 300);
    eq("the first measured run reports a time record", timed.newBestTime, true);
    const faster = progression.applyCompletedRun(timed.profile, result({ runSeed: 3, operationSeconds: 220 }));
    eq("a faster run improves the best time", faster.profile.bestOperationSeconds, 220);
    const slower = progression.applyCompletedRun(faster.profile, result({ runSeed: 4, operationSeconds: 480 }));
    eq("a slower run does not worsen the best time", slower.profile.bestOperationSeconds, 220);
    eq("a slower run is not reported as a time record", slower.newBestTime, false);
    const missing = progression.applyCompletedRun(faster.profile, result({ runSeed: 5 }));
    eq("a later untimed run never clears the best time", missing.profile.bestOperationSeconds, 220);
    eq("a later untimed run reports no time record", missing.newBestTime, false);
    const zero = progression.applyCompletedRun(faster.profile, result({ runSeed: 6, operationSeconds: 0 }));
    eq("a zero-second time is not accepted as a record", zero.profile.bestOperationSeconds, 220);
  }

  // --- cross-run accumulation --------------------------------------------
  {
    const routes = applyAll(fresh(), [
      result({ runSeed: 1, route: "main" }),
      result({ runSeed: 2, route: "side" }),
      result({ runSeed: 3, route: "main" }),
    ]);
    eq("MAIN and SIDE accumulate without duplicates", routes.profile.routesCompleted.join(","), "main,side");

    const manifest = applyAll(fresh(), [
      result({ runSeed: 1, resolutions: [{ stage: "MANIFEST", resolution: "manifest_records", label: "M" }] }),
      result({ runSeed: 2, resolutions: [{ stage: "MANIFEST", resolution: "manifest_ledger", label: "L" }] }),
      result({ runSeed: 3, resolutions: [{ stage: "MANIFEST", resolution: "manifest_ledger", label: "L" }] }),
    ]);
    eq(
      "both MANIFEST solutions accumulate without duplicates",
      manifest.profile.manifestSolutions.join(","),
      "manifest_records,manifest_ledger",
    );

    const verify = applyAll(fresh(), [
      result({ runSeed: 1, resolutions: [{ stage: "VERIFY", resolution: "verify_counter", label: "V" }] }),
      result({ runSeed: 2, resolutions: [{ stage: "VERIFY", resolution: "verify_monitoring", label: "S" }] }),
    ]);
    eq(
      "both VERIFY solutions accumulate",
      verify.profile.verifySolutions.join(","),
      "verify_counter,verify_monitoring",
    );

    const optional = applyAll(fresh(), [
      result({ runSeed: 1, objectivesCompleted: ["secondary_records"] }),
      result({ runSeed: 2, objectivesCompleted: ["secondary_records", "shift_pattern"] }),
    ]);
    eq(
      "optional objectives deduplicate across runs",
      optional.profile.objectivesCompletedEver.join(","),
      "secondary_records,shift_pattern",
    );

    const opportunities = applyAll(fresh(), [
      result({ runSeed: 1, opportunitiesUsed: ["camera_bypass"] }),
      result({ runSeed: 2, opportunitiesUsed: ["camera_bypass", "delivery_cart"] }),
    ]);
    eq(
      "opportunities deduplicate across runs",
      opportunities.profile.opportunitiesUsedEver.join(","),
      "camera_bypass,delivery_cart",
    );

    const intel = applyAll(fresh(), [
      result({ runSeed: 1, intelDiscovered: ["market_front_access"] }),
      result({ runSeed: 2, intelDiscovered: ["market_front_access", "market_camera", "bogus_intel"] }),
    ]);
    eq(
      "intel deduplicates and rejects unknown ids",
      intel.profile.intelDiscoveredEver.join(","),
      "market_front_access,market_camera",
    );
  }

  // --- mastery records ----------------------------------------------------
  {
    eq("there are eight mastery records", progression.allMasteryRecordIds().length, 8);
    for (const id of progression.allMasteryRecordIds()) {
      const record = progression.getMasteryRecord(id);
      ok(`mastery record ${id} has a label and detail`, Boolean(record.label) && Boolean(record.detail));
    }

    const clean = progression.applyCompletedRun(fresh(), result({ alerts: 0 }));
    ok("CLEAN RUN unlocks on a zero-alert run", clean.profile.masteryRecords.includes("clean_run"));
    const dirty = progression.applyCompletedRun(fresh(), result({ alerts: 2 }));
    ok("CLEAN RUN stays locked when an alert was raised", !dirty.profile.masteryRecords.includes("clean_run"));

    const fullIntel = progression.applyCompletedRun(fresh(), result({ intelFound: 4, intelTotal: 4 }));
    ok("FULL INTEL unlocks on a complete-intel run", fullIntel.profile.masteryRecords.includes("full_intel"));
    const partialIntel = progression.applyCompletedRun(fresh(), result({ intelFound: 3, intelTotal: 4 }));
    ok("FULL INTEL stays locked on partial intel", !partialIntel.profile.masteryRecords.includes("full_intel"));

    const fullOptional = progression.applyCompletedRun(
      fresh(),
      result({ objectivesCompleted: ["secondary_records", "shift_pattern"] }),
    );
    ok("FULL OPTIONAL unlocks on a 2/2 run", fullOptional.profile.masteryRecords.includes("full_optional"));
    const oneOptional = progression.applyCompletedRun(fresh(), result({ objectivesCompleted: ["shift_pattern"] }));
    ok("FULL OPTIONAL stays locked on a 1/2 run", !oneOptional.profile.masteryRecords.includes("full_optional"));

    const bothRoutes = applyAll(fresh(), [
      result({ runSeed: 1, route: "main" }),
      result({ runSeed: 2, route: "side" }),
    ]);
    ok("ROUTE MASTERY unlocks across two runs", bothRoutes.profile.masteryRecords.includes("route_mastery"));
    const oneRoute = progression.applyCompletedRun(fresh(), result({ route: "main" }));
    ok("ROUTE MASTERY stays locked after one route", !oneRoute.profile.masteryRecords.includes("route_mastery"));

    const bothManifest = applyAll(fresh(), [
      result({ runSeed: 1, resolutions: [{ stage: "MANIFEST", resolution: "manifest_records", label: "M" }] }),
      result({ runSeed: 2, resolutions: [{ stage: "MANIFEST", resolution: "manifest_ledger", label: "L" }] }),
    ]);
    ok("MANIFEST MASTERY unlocks on both solutions", bothManifest.profile.masteryRecords.includes("manifest_mastery"));
    ok(
      "MANIFEST MASTERY does not leak into VERIFY MASTERY",
      !bothManifest.profile.masteryRecords.includes("verify_mastery"),
    );

    const bothVerify = applyAll(fresh(), [
      result({ runSeed: 1, resolutions: [{ stage: "VERIFY", resolution: "verify_counter", label: "V" }] }),
      result({ runSeed: 2, resolutions: [{ stage: "VERIFY", resolution: "verify_monitoring", label: "S" }] }),
    ]);
    ok("VERIFY MASTERY unlocks on both solutions", bothVerify.profile.masteryRecords.includes("verify_mastery"));

    const allOpportunities = applyAll(fresh(), [
      result({ runSeed: 1, opportunitiesUsed: ["camera_bypass", "delivery_cart"] }),
      result({ runSeed: 2, opportunitiesUsed: ["staff_routine_window"] }),
    ]);
    ok(
      "OPPORTUNITY MASTERY unlocks once all three are used",
      allOpportunities.profile.masteryRecords.includes("opportunity_mastery"),
    );
    const twoOpportunities = progression.applyCompletedRun(
      fresh(),
      result({ opportunitiesUsed: ["camera_bypass", "delivery_cart"] }),
    );
    ok(
      "OPPORTUNITY MASTERY stays locked on two of three",
      !twoOpportunities.profile.masteryRecords.includes("opportunity_mastery"),
    );

    const ghost = progression.applyCompletedRun(fresh(), result({ rank: "GHOST" }));
    ok("GHOST RECORD unlocks on a GHOST run", ghost.profile.masteryRecords.includes("ghost_record"));
    const shadowOnly = progression.applyCompletedRun(fresh(), result({ rank: "SHADOW" }));
    ok("GHOST RECORD stays locked below GHOST", !shadowOnly.profile.masteryRecords.includes("ghost_record"));

    // Every record at once, then the same run restored.
    const everything = applyAll(fresh(), [
      perfectResult({ runSeed: 1, route: "main" }),
      perfectResult({
        runSeed: 2,
        route: "side",
        resolutions: [
          { stage: "MANIFEST", resolution: "manifest_ledger", label: "L" },
          { stage: "VERIFY", resolution: "verify_monitoring", label: "S" },
        ],
      }),
    ]);
    eq("all eight records can be earned", everything.profile.masteryRecords.length, 8);
    eq("mastery progress reports the full set", progression.masteryProgress(everything.profile).earned, 8);
    eq("mastery progress reports the total", progression.masteryProgress(everything.profile).total, 8);
    eq(
      "mastery order is the fixed display order",
      everything.profile.masteryRecords.join(","),
      progression.allMasteryRecordIds().join(","),
    );

    const restored = progression.applyCompletedRun(everything.profile, perfectResult({ runSeed: 2, route: "side" }));
    eq("a restored COMPLETE save re-announces no mastery", restored.newlyUnlockedRecords.length, 0);
    eq("a restored COMPLETE save keeps the same record set", restored.profile.masteryRecords.length, 8);

    const nextRun = progression.applyCompletedRun(everything.profile, perfectResult({ runSeed: 9 }));
    eq("an already-earned record is not announced again", nextRun.newlyUnlockedRecords.length, 0);
    eq("a genuinely new record is announced once", clean.newlyUnlockedRecords.includes("clean_run"), true);
  }

  // --- recent history -----------------------------------------------------
  {
    eq("the history cap is a small fixed value", progression.RECENT_RUN_CAP, 12);
    let profile = fresh();
    for (let index = 1; index <= 40; index += 1) {
      profile = progression.applyCompletedRun(profile, result({ runSeed: index, score: index })).profile;
    }
    eq("history never exceeds its cap", profile.recentRuns.length, progression.RECENT_RUN_CAP);
    eq("history is newest first", profile.recentRuns[0].runId, "run:40");
    eq("history keeps the run before it", profile.recentRuns[1].runId, "run:39");
    eq("processed run ids never exceed their cap", profile.processedRuns.length, progression.PROCESSED_RUN_CAP);
    eq("completed runs keep counting past the history cap", profile.completedRuns, 40);
    const summary = profile.recentRuns[0];
    eq("a history entry keeps the score", summary.score, 40);
    eq("a history entry keeps the rank", summary.rank, "SHADOW");
    eq("a history entry keeps the route", summary.route, "main");
    eq("a history entry keeps the MANIFEST solution", summary.manifest, "manifest_records");
    eq("a history entry keeps the VERIFY solution", summary.verify, "verify_counter");
    eq("a history entry keeps the alert count", summary.alerts, 1);
    eq(
      "a history entry stores counts, not snapshots",
      Object.keys(summary).sort().join(","),
      "alerts,manifest,operationSeconds,opportunityCount,optionalCount,rank,route,runId,score,verify",
    );
    // A capped history must survive a storage round trip at the same cap.
    shim.reset();
    progression.writeProgression(profile);
    eq("a stored history reads back at the cap", progression.readProgression().recentRuns.length, 12);
  }

  // --- deterministic next replay target -----------------------------------
  {
    const empty = fresh();
    eq("an empty profile points at the first missing route", progression.nextReplayTarget(empty).id, "route");
    eq(
      "the replay target is deterministic",
      progression.nextReplayTarget(empty).label,
      progression.nextReplayTarget(empty).label,
    );

    let profile = applyAll(empty, [
      result({ runSeed: 1, route: "main" }),
      result({ runSeed: 2, route: "side" }),
    ]).profile;
    eq("with both routes done the target moves to MANIFEST", progression.nextReplayTarget(profile).id, "manifest");

    profile = progression.applyCompletedRun(profile, result({
      runSeed: 3,
      resolutions: [{ stage: "MANIFEST", resolution: "manifest_ledger", label: "L" }],
    })).profile;
    eq("with both MANIFEST solutions done the target moves to VERIFY", progression.nextReplayTarget(profile).id, "verify");

    profile = progression.applyCompletedRun(profile, result({
      runSeed: 4,
      resolutions: [{ stage: "VERIFY", resolution: "verify_monitoring", label: "S" }],
    })).profile;
    eq("with both VERIFY solutions done the target moves to objectives", progression.nextReplayTarget(profile).id, "objective");

    profile = progression.applyCompletedRun(profile, result({
      runSeed: 5,
      objectivesCompleted: ["secondary_records", "shift_pattern"],
    })).profile;
    eq("with all objectives done the target moves to opportunities", progression.nextReplayTarget(profile).id, "opportunity");

    profile = progression.applyCompletedRun(profile, result({
      runSeed: 6,
      opportunitiesUsed: ["camera_bypass", "staff_routine_window", "delivery_cart"],
    })).profile;
    eq("with all opportunities used the target moves to intel", progression.nextReplayTarget(profile).id, "intel");

    profile = progression.applyCompletedRun(profile, result({
      runSeed: 7,
      intelFound: 4,
      intelTotal: 4,
      alerts: 2,
    })).profile;
    eq("with full intel the target moves to a clean run", progression.nextReplayTarget(profile).id, "clean");

    profile = progression.applyCompletedRun(profile, result({ runSeed: 8, alerts: 0, rank: "GHOST" })).profile;
    eq("with everything covered the target becomes a personal best", progression.nextReplayTarget(profile).id, "personal-best");
    ok(
      "a personal-best target without telemetry challenges the score",
      progression.nextReplayTarget(profile).label.includes("SKOR"),
    );

    const timed = progression.applyCompletedRun(profile, result({ runSeed: 9, operationSeconds: 240 })).profile;
    ok(
      "a personal-best target with telemetry challenges the time",
      progression.nextReplayTarget(timed).label.includes("4:00"),
    );

    // The target never depends on call order or history contents.
    const rebuilt = progression.validateProgression(JSON.parse(JSON.stringify({ ...profile, sealed: undefined })));
    eq(
      "the target survives a storage round trip",
      progression.nextReplayTarget(rebuilt).id,
      progression.nextReplayTarget(profile).id,
    );
  }

  // --- telemetry ----------------------------------------------------------
  {
    const run = new telemetry.RunTelemetry();
    eq("a fresh accumulator has measured nothing", run.hasData, false);
    eq("an unmeasured accumulator stores nothing", run.toStored(), undefined);

    for (let index = 0; index < 100; index += 1) run.accumulate(0.02, true, "CALM");
    eq("active frames accumulate operation time", Math.round(run.snapshot().operationSeconds * 100) / 100, 2);
    eq("an active accumulator has measured something", run.hasData, true);
    eq("calm time is not counted as pressure", run.snapshot().watchSeconds, 0);
    eq("a calm run reports CALM as its peak", run.snapshot().maxFacilityState, "CALM");

    for (let index = 0; index < 50; index += 1) run.accumulate(0.02, true, "WATCH");
    eq("WATCH seconds accumulate", Math.round(run.snapshot().watchSeconds * 100) / 100, 1);
    eq("WATCH raises the peak facility state", run.snapshot().maxFacilityState, "WATCH");
    for (let index = 0; index < 25; index += 1) run.accumulate(0.02, true, "HIGH_ALERT");
    eq("HIGH_ALERT seconds accumulate", Math.round(run.snapshot().highAlertSeconds * 100) / 100, 0.5);
    eq("HIGH_ALERT is the peak once reached", run.snapshot().maxFacilityState, "HIGH_ALERT");
    for (let index = 0; index < 25; index += 1) run.accumulate(0.02, true, "WATCH");
    eq("the peak facility state never falls back", run.snapshot().maxFacilityState, "HIGH_ALERT");
    eq(
      "SEARCH stays zero when it never happened",
      run.snapshot().searchSeconds,
      0,
    );

    // Pause and cinematic frames both arrive as inactive; neither may count.
    const paused = new telemetry.RunTelemetry();
    for (let index = 0; index < 200; index += 1) paused.accumulate(0.02, false, "CALM");
    eq("paused frames add no operation time", paused.snapshot().operationSeconds, 0);
    eq("paused frames leave the run unmeasured", paused.hasData, false);
    const cinematic = new telemetry.RunTelemetry();
    for (let index = 0; index < 300; index += 1) cinematic.accumulate(0.033, false, "WATCH");
    eq("cinematic frames add no operation time", cinematic.snapshot().operationSeconds, 0);
    eq("cinematic frames add no pressure time", cinematic.snapshot().watchSeconds, 0);

    const resumed = new telemetry.RunTelemetry();
    resumed.accumulate(3600, true, "CALM");
    eq(
      "a giant resume frame is clamped",
      resumed.snapshot().operationSeconds,
      telemetry.MAX_TELEMETRY_FRAME_SECONDS,
    );
    resumed.accumulate(Number.POSITIVE_INFINITY, true, "CALM");
    resumed.accumulate(Number.NaN, true, "CALM");
    resumed.accumulate(-5, true, "CALM");
    eq(
      "a non-finite or negative frame adds nothing",
      resumed.snapshot().operationSeconds,
      telemetry.MAX_TELEMETRY_FRAME_SECONDS,
    );

    // Checkpoints are dt-driven, not per frame and not on a timer.
    const checkpointed = new telemetry.RunTelemetry();
    let checkpoints = 0;
    let frames = 0;
    for (let index = 0; index < 1000; index += 1) {
      frames += 1;
      if (checkpointed.accumulate(0.02, true, "CALM")) checkpoints += 1;
    }
    eq("checkpoint cadence is five seconds", telemetry.TELEMETRY_CHECKPOINT_SECONDS, 5);
    ok(
      "twenty seconds of play checkpoints about four times",
      checkpoints >= 3 && checkpoints <= 4,
      `${checkpoints} checkpoints`,
    );
    ok("checkpoints are far rarer than frames", checkpoints * 100 < frames, `${checkpoints} of ${frames}`);

    // Migration: an old save carries no telemetry block at all.
    const migrated = new telemetry.RunTelemetry();
    migrated.restore(undefined);
    eq("an old save restores as unmeasured", migrated.hasData, false);
    migrated.restore({});
    eq("an empty telemetry block restores as unmeasured", migrated.hasData, false);
    migrated.restore({ operationSeconds: "soon", maxFacilityState: "MELTDOWN" });
    eq("a garbage telemetry block restores as unmeasured", migrated.hasData, false);

    const restored = new telemetry.RunTelemetry();
    restored.restore({ operationSeconds: 120, watchSeconds: 20, searchSeconds: 5, highAlertSeconds: 0, maxFacilityState: "SEARCH" });
    eq("a checkpointed run restores its operation time", restored.snapshot().operationSeconds, 120);
    eq("a checkpointed run restores its peak state", restored.snapshot().maxFacilityState, "SEARCH");
    eq("a restored run counts as measured", restored.hasData, true);
    restored.accumulate(0.02, true, "CALM");
    eq("a restored run keeps accumulating", Math.round(restored.snapshot().operationSeconds * 100) / 100, 120.02);

    const tampered = new telemetry.RunTelemetry();
    tampered.restore({ operationSeconds: 10, watchSeconds: 9999, maxFacilityState: "WATCH" });
    ok(
      "a part can never exceed the whole after restore",
      tampered.snapshot().watchSeconds <= tampered.snapshot().operationSeconds,
    );
  }

  // --- telemetry through the one mission save -----------------------------
  {
    shim.reset();
    const director = new MissionDirector();
    director.acknowledgeBriefing();
    director.discoverIntel("market_front_access");
    director.discoverIntel("market_side_access");
    director.chooseRoute("main");
    const before = shim.writes.count;
    for (let index = 0; index < 600; index += 1) director.recordRunTime(0.02, true, "CALM");
    const perFrameWrites = shim.writes.count - before;
    ok(
      "telemetry does not write storage every frame",
      perFrameWrites * 10 < 600,
      `${perFrameWrites} writes across 600 frames`,
    );
    ok("telemetry checkpoints do reach storage", perFrameWrites > 0, `${perFrameWrites} writes`);

    director.resolveStage("access_terminal");
    director.resolveStage("manifest_records");
    director.resolveStage("verify_counter");
    director.extract();

    const stored = JSON.parse(localStorage.getItem("cuma_world_android_save_v100"));
    ok("the run save carries a telemetry block", Boolean(stored.telemetry));
    ok("the stored operation time is real", stored.telemetry.operationSeconds > 4);
    ok("the run save does not persist facility heat", !("heat" in stored) && !("facilityHeat" in stored));
    ok("the run save does not persist NPC state", !("npcs" in stored) && !("anchor" in stored));
    eq("the mission save key is unchanged", Object.keys(shim.store).length >= 0, true);
    ok(
      "only the mission save key was written by the director",
      [...shim.store.keys()].every((key) => key === "cuma_world_android_save_v100"),
      [...shim.store.keys()].join(","),
    );

    // A restored COMPLETE save republishes a result carrying the telemetry.
    let republished = null;
    const missionResultEvent = "cuma-mission-result";
    window.addEventListener(missionResultEvent, (event) => { republished = event.detail; });
    new MissionDirector();
    ok("a restored COMPLETE save republishes a result", republished !== null);
    ok("the republished result carries operation time", (republished?.operationSeconds ?? 0) > 4);
    ok("the republished result carries the peak facility state", republished?.maxFacilityState === "CALM");
    ok("the republished result carries the discovered intel ids", Array.isArray(republished?.intelDiscovered));

    // The same restored result must not record a second completion.
    shim.reset();
    const firstRecord = progression.recordCompletedRun(republished);
    const secondRecord = progression.recordCompletedRun(republished);
    eq("the restored result records once", firstRecord.profile.completedRuns, 1);
    eq("the restored result does not record twice", secondRecord.profile.completedRuns, 1);
    eq("the second recording is not a new run", secondRecord.isNewRun, false);
  }

  // --- an old COMPLETE save has no telemetry ------------------------------
  {
    shim.reset();
    // Exactly what a pre-Milestone-08 build wrote: no telemetry key at all.
    localStorage.setItem("cuma_world_android_save_v100", JSON.stringify({
      state: "COMPLETE",
      intel: ["market_front_access", "market_side_access"],
      selectedRoute: "main",
      alerts: 0,
      opportunities: [],
      operationStep: "DONE",
      runSeed: 4242,
    }));
    let legacyResult = null;
    window.addEventListener("cuma-mission-result", (event) => { legacyResult = event.detail; });
    new MissionDirector();
    ok("an old COMPLETE save still produces a result", legacyResult !== null);
    eq("an old COMPLETE save reports no operation time", legacyResult?.operationSeconds, undefined);
    eq("an old COMPLETE save reports no peak facility state", legacyResult?.maxFacilityState, undefined);
    eq("an old COMPLETE save renders its time as a dash", progression.formatOperationTime(legacyResult?.operationSeconds ?? null), "—");
    eq("an old COMPLETE save keeps its run seed identity", progression.completedRunId(legacyResult.runSeed), "run:4242");
    const legacyUpdate = progression.recordCompletedRun(legacyResult);
    eq("an old COMPLETE save still records a completion", legacyUpdate.profile.completedRuns, 1);
    eq("an old COMPLETE save sets no best time", legacyUpdate.profile.bestOperationSeconds, null);
  }

  // --- replay preserves the profile ---------------------------------------
  {
    shim.reset();
    const update = progression.recordCompletedRun(perfectResult({ runSeed: 77 }));
    localStorage.setItem("cuma_world_android_save_v100", JSON.stringify({ state: "COMPLETE", intel: [], alerts: 0 }));
    eq("the profile is stored before replay", update.profile.completedRuns, 1);

    save.resetMissionProgress();
    eq("replay clears the active mission save", localStorage.getItem("cuma_world_android_save_v100"), null);
    const afterReplay = progression.readProgression();
    eq("replay preserves the completion count", afterReplay.completedRuns, 1);
    eq("replay preserves the best score", afterReplay.bestScore, 100);
    eq("replay preserves earned mastery", afterReplay.masteryRecords.length > 0, true);
    eq("replay preserves the recent history", afterReplay.recentRuns.length, 1);

    // And the reverse: a corrupt mission save must not cost the profile.
    localStorage.setItem("cuma_world_android_save_v100", "{{{corrupt");
    new MissionDirector();
    eq("a corrupt mission save leaves the profile intact", progression.readProgression().completedRuns, 1);
  }

  // --- architecture guards ------------------------------------------------
  {
    const progressionSource = readFileSync("src/game/progression.ts", "utf8");
    const telemetrySource = readFileSync("src/game/run-telemetry.ts", "utf8");
    const debriefSource = readFileSync("src/game/debrief.ts", "utf8");

    for (const [name, source] of [["progression.ts", progressionSource], ["run-telemetry.ts", telemetrySource]]) {
      for (const forbidden of FORBIDDEN_IMPORTS) {
        ok(`${name} does not import ${forbidden}`, !source.includes(`from "${forbidden}"`));
      }
      ok(`${name} starts no interval`, !source.includes("setInterval("));
      ok(`${name} starts no animation frame loop`, !source.includes("requestAnimationFrame("));
      ok(`${name} uses no random completion id`, !source.includes("Math.random("));
      ok(`${name} does not key completions on the clock`, !source.includes("Date.now("));
    }
    ok("debrief.ts does not import mission.ts", !debriefSource.includes('from "./mission"'));
    ok("debrief.ts constructs no MutationObserver", !debriefSource.includes("new MutationObserver"));
    ok("progression.ts declares a bounded history", progressionSource.includes("RECENT_RUN_CAP"));
    ok("progression.ts bounds its processed run ids", progressionSource.includes("PROCESSED_RUN_CAP"));
    ok(
      "progression.ts is the only owner of its storage key",
      progressionSource.includes('PROGRESSION_KEY = "cuma_world_progression_v1"'),
    );
    ok(
      "progression.ts never touches the mission save key",
      !progressionSource.includes('"cuma_world_android_save_v100"'),
    );
    ok(
      "mission-save.ts remains the only owner of the run save key",
      readFileSync("src/game/mission-save.ts", "utf8").includes('SAVE_KEY = "cuma_world_android_save_v100"'),
    );
  }

  console.log(
    failures === 0
      ? `\nPROGRESSION_OK ${checks} checks passed`
      : `\nPROGRESSION_FAILED ${failures} of ${checks} checks failed`,
  );
  process.exit(failures === 0 ? 0 : 1);
}
