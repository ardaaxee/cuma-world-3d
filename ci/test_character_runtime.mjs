#!/usr/bin/env node
/**
 * Contract tests for the hero-character runtime logic.
 *
 * The animation resolver, the crossfade blender and the facial-life layer are
 * pure logic with type-only Babylon imports, so they can be compiled with the
 * TypeScript already in devDependencies and exercised under plain Node. No test
 * framework and no extra dependency.
 *
 *   node ci/test_character_runtime.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCES = [
  "src/game/character-animation.ts",
  "src/game/character-blender.ts",
  "src/game/character-face.ts",
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

/** Compiles the modules to plain ESM and returns the output directory. */
function compile() {
  const outDir = mkdtempSync(join(tmpdir(), "cuma-character-"));
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", ...SOURCES, "--outDir", outDir, "--module", "esnext", "--target", "es2022",
      "--moduleResolution", "bundler", "--skipLibCheck", "--strict"],
    { stdio: "inherit", cwd: resolve(".") },
  );
  // tsc keeps extensionless relative specifiers; Node ESM needs them explicit.
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

const mkGroup = (name) => ({
  name,
  speedRatio: 1,
  weight: 1,
  playing: false,
  loop: null,
  starts: 0,
  stop() { this.playing = false; },
  start(loop, rate) { this.playing = true; this.loop = loop; this.speedRatio = rate; this.starts += 1; },
  setWeightForAllAnimatables(weight) { this.weight = weight; },
});

const mkTarget = (name) => ({ name, influence: 0 });
const mkMesh = (...targets) => ({
  morphTargetManager: targets.length
    ? { numTargets: targets.length, getTarget: (index) => targets[index] }
    : null,
});

function testResolver({ resolveAnimationGroups, selectPlayableGroup, hasRequiredStates }) {
  console.log("\n--- animation resolver ---");

  // The asset CI actually packages today.
  const fallback = resolveAnimationGroups(["idle", "run", "walk", "wave"].map(mkGroup));
  eq("fallback resolves idle", fallback.get("idle")?.name, "idle");
  eq("fallback resolves walk", fallback.get("walk")?.name, "walk");
  eq("fallback resolves run", fallback.get("run")?.name, "run");
  eq("fallback satisfies the required contract", hasRequiredStates(fallback), true);
  ok("an emote is never claimed as locomotion", ![...fallback.values()].some((g) => g.name === "wave"));
  eq("crouch degrades to idle", selectPlayableGroup(fallback, "crouch_idle")?.name, "idle");
  eq("crouch_walk degrades to walk", selectPlayableGroup(fallback, "crouch_walk")?.name, "walk");
  eq("cover_locomotion degrades to walk", selectPlayableGroup(fallback, "cover_locomotion")?.name, "walk");

  // Specific clips must win even when listed before the generic ones.
  const full = resolveAnimationGroups(
    ["crouch_walk", "crouch_idle", "walk", "idle", "sprint", "jump_start", "landing", "fall_loop", "cover_idle"].map(mkGroup),
  );
  eq("walk is not stolen by crouch_walk", full.get("walk")?.name, "walk");
  eq("idle is not stolen by crouch_idle", full.get("idle")?.name, "idle");
  eq("crouch_walk keeps its own clip", full.get("crouch_walk")?.name, "crouch_walk");
  eq("crouch_idle keeps its own clip", full.get("crouch_idle")?.name, "crouch_idle");
  eq("run matches sprint", full.get("run")?.name, "sprint");
  eq("airborne matches fall_loop", full.get("airborne")?.name, "fall_loop");
  eq("landing is not stolen by airborne", full.get("landing")?.name, "landing");

  // Names as they come out of real DCC exports.
  const dcc = resolveAnimationGroups(
    ["Armature|Idle_Loop", "Armature|Walk_Fwd", "Armature|Sprint_Fwd", "Armature|Crouch_Idle"].map(mkGroup),
  );
  eq("pipe-separated export idle", dcc.get("idle")?.name, "Armature|Idle_Loop");
  eq("pipe-separated export run", dcc.get("run")?.name, "Armature|Sprint_Fwd");
  eq("pipe-separated export crouch_idle", dcc.get("crouch_idle")?.name, "Armature|Crouch_Idle");

  const empty = resolveAnimationGroups([]);
  eq("an empty GLB fails the required contract", hasRequiredStates(empty), false);
  eq("an empty GLB selects nothing", selectPlayableGroup(empty, "idle"), null);
}

function testBlender({ AnimationBlender, CROSSFADE_SECONDS }, { resolveAnimationGroups }) {
  console.log("\n--- crossfade blender ---");
  const build = (names) => {
    const groups = names.map(mkGroup);
    const blender = new AnimationBlender();
    blender.setGroups(resolveAnimationGroups(groups));
    return { blender, by: (name) => groups.find((g) => g.name === name), groups };
  };
  const step = (blender, seconds) => {
    for (let i = 0; i < Math.round(seconds * 60); i += 1) blender.update(1 / 60);
  };

  {
    const { blender, by } = build(["idle", "walk", "run"]);
    blender.play("idle");
    eq("first clip starts at full weight", by("idle").weight, 1);
    blender.play("walk");
    eq("incoming clip starts silent", by("walk").weight, 0);
    step(blender, CROSSFADE_SECONDS / 2);
    ok("weights sum to one mid-blend", Math.abs(by("walk").weight + by("idle").weight - 1) < 1e-9);
    step(blender, CROSSFADE_SECONDS);
    eq("incoming clip reaches full weight", by("walk").weight, 1);
    eq("outgoing clip is stopped", by("idle").playing, false);
  }

  {
    const { blender, by } = build(["idle", "walk", "run"]);
    blender.play("walk");
    step(blender, 1);
    const starts = by("walk").starts;
    for (let i = 0; i < 600; i += 1) { blender.play("walk"); blender.update(1 / 60); }
    eq("a held state never restarts its clip", by("walk").starts, starts);
    blender.play("crouch_walk");
    eq("a state sharing a fallback clip does not restart it", by("walk").starts, starts);
  }

  {
    const { blender, by } = build(["idle", "walk", "run"]);
    blender.play("walk");
    step(blender, 1);
    blender.play("run");
    step(blender, CROSSFADE_SECONDS * 0.4);
    const walkStarts = by("walk").starts;
    blender.play("walk");
    eq("reversing a blend does not restart the returning clip", by("walk").starts, walkStarts);
    step(blender, CROSSFADE_SECONDS * 2);
    eq("the returning clip wins", by("walk").weight, 1);
    eq("the abandoned clip stops", by("run").playing, false);
  }

  {
    const { blender, groups } = build(["idle", "walk", "run", "crouch_idle", "crouch_walk", "jump_start", "fall", "landing"]);
    const states = ["idle", "walk", "run", "crouch_walk", "jump_start", "airborne", "landing", "crouch_idle", "cover_idle"];
    let worst = 0;
    for (let i = 0; i < 4000; i += 1) {
      blender.play(states[i % states.length]);
      blender.update(1 / 60);
      worst = Math.max(worst, groups.filter((g) => g.playing && g.weight > 0.001).length);
    }
    ok("rapid state churn never runs more than two clips", worst <= 2, `worst=${worst}`);
    step(blender, 1);
    eq("churn settles onto exactly one clip", groups.filter((g) => g.playing && g.weight > 0.001).length, 1);
  }

  {
    const { blender, by } = build(["idle", "walk", "run", "jump_start", "landing"]);
    blender.play("jump_start");
    eq("jump_start is a one-shot", by("jump_start").loop, false);
    blender.play("landing");
    eq("landing is a one-shot", by("landing").loop, false);
    blender.play("run");
    eq("run loops", by("run").loop, true);
    eq("run carries its playback rate", by("run").speedRatio, 1.08);
  }

  {
    // The degraded case: one clip for everything.
    const { blender, by } = build(["idle"]);
    blender.play("idle");
    step(blender, 0.5);
    const starts = by("idle").starts;
    for (const state of ["walk", "run", "crouch_walk", "airborne", "landing", "cover_idle"]) {
      blender.play(state);
      step(blender, 0.1);
    }
    eq("an idle-only asset never restarts", by("idle").starts, starts);
    eq("an idle-only asset stays at full weight", by("idle").weight, 1);
  }

  {
    const blender = new AnimationBlender();
    blender.setGroups(resolveAnimationGroups([]));
    blender.play("idle");
    blender.update(1 / 60);
    eq("an asset with no clips stays stateless", blender.currentState, "");
  }
}

function testFace({ FacialLifeLayer }) {
  console.log("\n--- facial life layer ---");

  {
    // The current CC0 fallback has zero morph targets. This must be silent.
    const face = new FacialLifeLayer();
    face.attach([mkMesh(), mkMesh()]);
    eq("an asset without morph targets is inactive", face.isActive, false);
    for (let i = 0; i < 600; i += 1) face.update(1 / 60, false);
    ok("ten seconds of updates on an assetless face is a no-op", true);
  }

  {
    const blink = mkTarget("Blink");
    const face = new FacialLifeLayer();
    face.attach([mkMesh(blink)]);
    eq("a blink target activates the layer", face.isActive, true);

    let peak = 0;
    let closedFrames = 0;
    let blinks = 0;
    let wasClosed = false;
    for (let i = 0; i < 60 * 30; i += 1) {
      face.update(1 / 60, false);
      peak = Math.max(peak, blink.influence);
      const closed = blink.influence > 0.5;
      if (closed && !wasClosed) blinks += 1;
      if (closed) closedFrames += 1;
      wasClosed = closed;
    }
    ok("the eye fully closes", peak > 0.98, `peak=${peak.toFixed(3)}`);
    ok("blink rate is plausible over 30s", blinks >= 5 && blinks <= 9, `blinks=${blinks}`);
    ok("the eye is open almost all the time", closedFrames / (60 * 30) < 0.05);
  }

  {
    // No RNG anywhere: the same second always produces the same face.
    const trace = () => {
      const blink = mkTarget("blink");
      const face = new FacialLifeLayer();
      face.attach([mkMesh(blink)]);
      const out = [];
      for (let i = 0; i < 1200; i += 1) { face.update(1 / 60, false); out.push(blink.influence); }
      return out.join(",");
    };
    eq("the layer is deterministic", trace() === trace(), true);
  }

  {
    const up = mkTarget("eyeLookUp");
    const down = mkTarget("eyeLookDown");
    const left = mkTarget("eyeLookLeft");
    const right = mkTarget("eyeLookRight");
    const face = new FacialLifeLayer();
    face.attach([mkMesh(up, down, left, right)]);
    let peak = 0;
    let opposed = false;
    for (let i = 0; i < 60 * 40; i += 1) {
      face.update(1 / 60, false);
      peak = Math.max(peak, up.influence, down.influence, left.influence, right.influence);
      if (up.influence > 0 && down.influence > 0) opposed = true;
    }
    ok("gaze actually drifts", peak > 0.02);
    ok("gaze stays subtle", peak <= 0.2201, `peak=${peak.toFixed(3)}`);
    ok("opposing gaze targets never fire together", !opposed);
    face.update(1 / 60, true);
    ok("reduced motion parks the gaze", up.influence === 0 && down.influence === 0 && left.influence === 0 && right.influence === 0);
  }

  {
    const countBlinks = (reduced) => {
      const blink = mkTarget("blink");
      const face = new FacialLifeLayer();
      face.attach([mkMesh(blink)]);
      let blinks = 0;
      let wasClosed = false;
      for (let i = 0; i < 60 * 60; i += 1) {
        face.update(1 / 60, reduced);
        const closed = blink.influence > 0.5;
        if (closed && !wasClosed) blinks += 1;
        wasClosed = closed;
      }
      return blinks;
    };
    const normal = countBlinks(false);
    const reduced = countBlinks(true);
    ok("reduced motion blinks less but still blinks", reduced < normal && reduced > 0, `normal=${normal} reduced=${reduced}`);
  }

  {
    const blink = mkTarget("blink");
    const face = new FacialLifeLayer();
    face.attach([mkMesh(blink)]);
    for (let i = 0; i < 300; i += 1) face.update(1 / 60, false);
    face.reset();
    eq("reset leaves no stuck influence", blink.influence, 0);
    eq("reset deactivates the layer", face.isActive, false);
  }
}

const outDir = compile();
try {
  const load = (name) => import(pathToFileURL(join(outDir, name)).href);
  const animation = await load("character-animation.js");
  const blender = await load("character-blender.js");
  const face = await load("character-face.js");

  testResolver(animation);
  testBlender(blender, animation);
  testFace(face);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(
  failures === 0
    ? `\nCHARACTER_RUNTIME_OK ${checks} checks passed`
    : `\nCHARACTER_RUNTIME_FAILED ${failures} of ${checks} checks failed`,
);
process.exit(failures === 0 ? 0 : 1);
