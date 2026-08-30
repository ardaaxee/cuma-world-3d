#!/usr/bin/env node
/**
 * Contract tests for the Milestone 07 audio system.
 *
 * The gait scheduler, mix model, acoustic classifier and typed world-audio
 * contract are pure logic, so they compile with the TypeScript already in
 * devDependencies and run under plain Node with a small DOM shim.
 *
 *   node ci/test_audio_runtime.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCES = [
  "src/game/audio-model.ts",
  "src/game/audio-surfaces.ts",
  "src/game/audio-events.ts",
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
  const outDir = mkdtempSync(join(tmpdir(), "cuma-audio-"));
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

function installDomShim() {
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
  return { listenerCount: (type) => (listeners.get(type) ?? []).length };
}

const shim = installDomShim();
const outDir = compile();

try {
  const model = await import(pathToFileURL(join(outDir, "audio-model.js")).href);
  const surfaces = await import(pathToFileURL(join(outDir, "audio-surfaces.js")).href);
  const events = await import(pathToFileURL(join(outDir, "audio-events.js")).href);
  runTests(model, surfaces, events);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

function runTests(model, surfaces, events) {
  const { GaitScheduler, strideFor, MIN_STEP_SPEED } = model;

  /** Walks a scheduler for `seconds` at a constant speed, counting steps. */
  const walk = (gait, speed, seconds, mode, dt = 1 / 60) => {
    let steps = 0;
    const frames = Math.round(seconds / dt);
    for (let i = 0; i < frames; i += 1) {
      if (gait.update(speed * dt, speed, mode)) steps += 1;
    }
    return steps;
  };

  console.log("\n--- idle and jitter ---");
  {
    const gait = new GaitScheduler();
    eq("standing still emits no steps", walk(gait, 0, 10, "WALK"), 0);
  }
  {
    const gait = new GaitScheduler();
    // Joystick jitter: real but tiny speed, well under the movement threshold.
    let steps = 0;
    for (let i = 0; i < 60 * 20; i += 1) {
      const speed = 0.2 + 0.15 * Math.sin(i * 0.7);
      if (gait.update(Math.abs(speed) / 60, Math.abs(speed), "WALK")) steps += 1;
    }
    eq("joystick jitter never emits a step", steps, 0);
  }
  {
    const gait = new GaitScheduler();
    ok("the movement threshold is above jitter but below a walk",
      MIN_STEP_SPEED > 0.3 && MIN_STEP_SPEED < 1.0, `MIN_STEP_SPEED=${MIN_STEP_SPEED}`);
  }

  console.log("\n--- distance-based gait ---");
  {
    // The whole point: steps track distance, not elapsed time.
    const slow = new GaitScheduler();
    const fast = new GaitScheduler();
    const slowSteps = walk(slow, 1.6, 10, "WALK");
    const fastSteps = walk(fast, 3.2, 5, "WALK");
    eq("same distance produces the same step count regardless of speed", slowSteps, fastSteps);
    ok("that count matches the stride", Math.abs(slowSteps - (1.6 * 10) / strideFor("WALK")) <= 1,
      `steps=${slowSteps} expected~${((1.6 * 10) / strideFor("WALK")).toFixed(1)}`);
  }
  {
    const gait = new GaitScheduler();
    let steps = 0;
    for (let i = 0; i < 600; i += 1) if (gait.update(0.02, 1.2, "WALK")) steps += 1;
    ok("at most one step per update", steps <= 600);
    ok("steps actually fired", steps > 5, `steps=${steps}`);
  }

  console.log("\n--- locomotion modes ---");
  {
    const distance = 12;
    const count = (mode) => {
      const gait = new GaitScheduler();
      const speed = 2.0;
      return walk(gait, speed, distance / speed, mode);
    };
    const crouch = count("CROUCH");
    const walkSteps = count("WALK");
    const run = count("RUN");
    ok("crouch takes the most steps over a distance", crouch > walkSteps, `crouch=${crouch} walk=${walkSteps}`);
    ok("run takes the fewest", run < walkSteps, `run=${run} walk=${walkSteps}`);
    ok("stride order is crouch < walk < run",
      strideFor("CROUCH") < strideFor("WALK") && strideFor("WALK") < strideFor("RUN"));
  }
  {
    // Switching mode must not double-fire or swallow a step: the gait phase is
    // rescaled into the new stride.
    const gait = new GaitScheduler();
    gait.update(0.7, 2.0, "WALK");   // banked just under a walk stride
    const bankedFraction = gait.bankedDistance / strideFor("WALK");
    const immediate = gait.update(0, 2.0, "RUN");
    eq("changing WALK->RUN does not fire a step by itself", immediate, null);
    const newFraction = gait.bankedDistance / strideFor("RUN");
    ok("gait phase is preserved across the mode change",
      Math.abs(bankedFraction - newFraction) < 1e-9,
      `walk=${bankedFraction.toFixed(4)} run=${newFraction.toFixed(4)}`);
  }
  {
    const gait = new GaitScheduler();
    gait.update(1.0, 3.5, "RUN");
    const immediate = gait.update(0, 3.5, "WALK");
    eq("changing RUN->WALK does not fire a step by itself", immediate, null);
    ok("banked distance stays below the new stride", gait.bankedDistance < strideFor("WALK"));
  }

  console.log("\n--- pause / cinematic never banks a burst ---");
  {
    const gait = new GaitScheduler();
    walk(gait, 2.0, 3, "WALK");
    gait.reset();
    eq("reset clears the bank", gait.bankedDistance, 0);
    const immediate = gait.update(0, 0, "WALK");
    eq("no step fires immediately after a reset", immediate, null);
  }
  {
    // One enormous frame (a resumed tab) must not dump a burst of steps.
    const gait = new GaitScheduler();
    let steps = 0;
    if (gait.update(500, 4.0, "RUN")) steps += 1;
    eq("a huge frame still emits at most one step", steps, 1);
    ok("banked distance is capped, not hoarded",
      gait.bankedDistance <= strideFor("RUN") + 1e-9, `banked=${gait.bankedDistance}`);
    let follow = 0;
    for (let i = 0; i < 120; i += 1) if (gait.update(0, 0, "RUN")) follow += 1;
    eq("and standing still afterwards fires nothing", follow, 0);
  }

  console.log("\n--- deterministic variation ---");
  {
    const trace = () => {
      const gait = new GaitScheduler();
      const out = [];
      for (let i = 0; i < 600; i += 1) {
        const step = gait.update(0.05, 2.0, "WALK");
        if (step) out.push(`${step.sampleIndex}:${step.rateBias.toFixed(3)}:${step.gain.toFixed(4)}`);
      }
      return out.join(",");
    };
    eq("the same walk always produces the same steps", trace() === trace(), true);
    ok("no Math.random in the gait source",
      !readFileSync("src/game/audio-model.ts", "utf8").includes("Math.random("));
  }
  {
    const gait = new GaitScheduler();
    const samples = [];
    const rates = new Set();
    for (let i = 0; i < 2000; i += 1) {
      const step = gait.update(0.05, 2.0, "WALK");
      if (step) { samples.push(step.sampleIndex); rates.add(step.rateBias); }
    }
    ok("feet alternate", samples.slice(0, 6).join("") === "010101", `got=${samples.slice(0, 6).join("")}`);
    ok("pitch varies across several values", rates.size >= 4, `distinct=${rates.size}`);
  }

  console.log("\n--- acoustic classification ---");
  {
    const { classifyAcoustic, surfaceFor, acousticMixFor, allAcousticZones } = surfaces;
    eq("plaza in front of the market is outdoors", classifyAcoustic(0, 0.9, -8), "OUTDOOR");
    eq("market sales floor is interior", classifyAcoustic(0, 0.9, 8), "MARKET");
    eq("staff corridor is back of house", classifyAcoustic(-3, 0.9, 15.5), "BACK_OFFICE");
    eq("records room is back of house", classifyAcoustic(-5, 0.9, 20.5), "BACK_OFFICE");
    eq("loading bay is the loading context", classifyAcoustic(10, 0.9, 10), "LOADING");
    eq("service alley is the loading context", classifyAcoustic(10, 0.9, 17), "LOADING");
    eq("far outside is outdoors", classifyAcoustic(0, 0.9, -25), "OUTDOOR");
    eq("above the roof is outdoors", classifyAcoustic(0, 9, 8), "OUTDOOR");

    for (const zone of allAcousticZones()) {
      const surface = surfaceFor(zone);
      ok(`${zone} surface is coherent`,
        surface.stepRateMin < surface.stepRateMax && surface.stepGain > 0 && surface.stepFilterHz > 100);
    }
    // Interiors must keep less high end than open air; that is the whole point.
    ok("interiors are duller than outdoors",
      surfaceFor("BACK_OFFICE").stepFilterHz < surfaceFor("MARKET").stepFilterHz
      && surfaceFor("MARKET").stepFilterHz < surfaceFor("OUTDOOR").stepFilterHz);
    ok("the city bed is loudest outdoors",
      acousticMixFor("OUTDOOR").cityGain > acousticMixFor("LOADING").cityGain
      && acousticMixFor("LOADING").cityGain > acousticMixFor("MARKET").cityGain
      && acousticMixFor("MARKET").cityGain > acousticMixFor("BACK_OFFICE").cityGain);
    ok("the city bed is most filtered deepest inside",
      acousticMixFor("BACK_OFFICE").cityFilterHz < acousticMixFor("MARKET").cityFilterHz
      && acousticMixFor("MARKET").cityFilterHz < acousticMixFor("OUTDOOR").cityFilterHz);
    eq("outdoors has no room tone", acousticMixFor("OUTDOOR").roomToneGain, 0);
    ok("enclosed rooms have the most room tone",
      acousticMixFor("BACK_OFFICE").roomToneGain > acousticMixFor("MARKET").roomToneGain);
  }

  console.log("\n--- facility tension mix ---");
  {
    const { tensionTargetFor } = model;
    eq("calm is silent", tensionTargetFor("CALM"), 0);
    ok("tension rises strictly with facility state",
      tensionTargetFor("CALM") < tensionTargetFor("WATCH")
      && tensionTargetFor("WATCH") < tensionTargetFor("SEARCH")
      && tensionTargetFor("SEARCH") < tensionTargetFor("HIGH_ALERT"));
    ok("even HIGH_ALERT stays within a bounded bed", tensionTargetFor("HIGH_ALERT") <= 1);
    ok("the tension bus sits below footsteps in the mix",
      model.MIX.tension < model.MIX.player, `tension=${model.MIX.tension} player=${model.MIX.player}`);
    ok("ambience sits below footsteps and world cues",
      model.MIX.ambience < model.MIX.player && model.MIX.ambience < model.MIX.world);
    ok("world-local interaction is the loudest category",
      model.MIX.world >= model.MIX.player && model.MIX.world >= model.MIX.presentation);
  }

  console.log("\n--- master volume and mute ---");
  {
    const { clampVolume, isMuted } = model;
    eq("volume clamps low", clampVolume(-3), 0);
    eq("volume clamps high", clampVolume(9), 1);
    eq("NaN is treated as silent", clampVolume(Number.NaN), 0);
    eq("zero is muted", isMuted(0), true);
    eq("a whisper is not muted", isMuted(0.01), false);
    eq("full is not muted", isMuted(1), false);
  }

  console.log("\n--- spatial voice pool ---");
  {
    const { selectVoiceSlot, MAX_SPATIAL_VOICES, SPATIAL_MAX_DISTANCE, SPATIAL_REF_DISTANCE } = model;
    ok("voice cap is in the mobile range", MAX_SPATIAL_VOICES >= 4 && MAX_SPATIAL_VOICES <= 8,
      `cap=${MAX_SPATIAL_VOICES}`);
    eq("a free slot is reused first", selectVoiceSlot([1, null, 3], 10), 1);
    eq("the first free slot wins", selectVoiceSlot([null, null], 10), 0);
    eq("a full pool steals the oldest", selectVoiceSlot([5, 2, 9], 10), 1);
    eq("a full pool of equals steals the first", selectVoiceSlot([4, 4, 4], 10), 0);

    // Rapid events must never exceed the cap.
    const slots = new Array(MAX_SPATIAL_VOICES).fill(null);
    for (let i = 0; i < 200; i += 1) {
      const slot = selectVoiceSlot(slots, i);
      ok_silent(slot >= 0 && slot < MAX_SPATIAL_VOICES);
      slots[slot] = i;
    }
    eq("the pool never grows past the cap", slots.length, MAX_SPATIAL_VOICES);
    ok("attenuation is bounded to the small map",
      SPATIAL_MAX_DISTANCE > 0 && SPATIAL_MAX_DISTANCE <= 40 && SPATIAL_REF_DISTANCE < SPATIAL_MAX_DISTANCE,
      `ref=${SPATIAL_REF_DISTANCE} max=${SPATIAL_MAX_DISTANCE}`);
  }

  console.log("\n--- typed world-audio contract ---");
  {
    const received = [];
    const stop = events.onWorldAudio((event) => received.push(event));

    events.publishWorldAudio("door-open", 1, 2, 3, 0.8);
    eq("a world cue is delivered once", received.length, 1);
    eq("cue id is carried", received[0].cue, "door-open");
    eq("position is carried", `${received[0].x},${received[0].y},${received[0].z}`, "1,2,3");
    eq("strength is carried", received[0].strength, 0.8);
    eq("a positioned cue is spatial", received[0].local, false);

    events.publishLocalAudio("landing", 0.4);
    eq("a local cue is not spatial", received[1].local, true);
    eq("strength clamps high", (events.publishWorldAudio("scan", 0, 0, 0, 99), received[2].strength), 1);
    eq("strength clamps low", (events.publishWorldAudio("jam", 0, 0, 0, -5), received[3].strength), 0);

    stop();
    events.publishWorldAudio("decoy", 0, 0, 0, 1);
    eq("unsubscribing stops delivery", received.length, 4);
    eq("no listener is left behind", shim.listenerCount("cuma-world-audio"), 0);
  }

  console.log("\n--- one audible owner per cue ---");
  {
    // GameAudio is the only subscriber to presentation cues after the M07
    // consolidation; UiAudioFeedback no longer exists.
    const source = readFileSync("src/game/audio.ts", "utf8");
    ok("GameAudio subscribes to presentation cues", source.includes("onPresentation"));
    ok("GameAudio subscribes to world audio cues", source.includes("onWorldAudio"));
    ok("GameAudio creates exactly one AudioContext",
      (source.match(/new AudioContext\(/g) ?? []).length === 1);
    let missing = false;
    try { readFileSync("src/game/ui-audio-feedback.ts", "utf8"); } catch { missing = true; }
    ok("the second audio engine is gone", missing);
    const mainSource = readFileSync("src/main.ts", "utf8");
    ok("main.ts unlocks only one audio engine", !mainSource.includes("UiAudioFeedback"));
  }

  console.log("\n--- gadget and world cue mapping ---");
  {
    const source = readFileSync("src/game/gadgets.ts", "utf8");
    ok("SCAN publishes a cue", source.includes('publishLocalAudio("scan"'));
    ok("JAM publishes a cue", source.includes('publishLocalAudio("jam"'));
    ok("DECOY publishes a spatial cue at the decoy point",
      source.includes('publishWorldAudio("decoy", point.x, point.y, point.z'));
    ok("gadget cooldowns are untouched", source.includes("cooldownMs") && source.includes("this.readyAt.set"));
    ok("no second cooldown timer was added",
      (source.match(/setInterval\(/g) ?? []).length === 1);

    const cart = readFileSync("src/game/delivery-cart.ts", "utf8");
    ok("the cart publishes start and stop cues",
      cart.includes('publishWorldAudio("cart-start"') && cart.includes('publishWorldAudio("cart-stop"'));
    ok("cart movement has no new timer", !cart.includes("setInterval") && !cart.includes("requestAnimationFrame"));
  }

  console.log("\n--- gameplay-noise separation ---");
  {
    // The proof that muting cannot make the player stealthier: the pure audio
    // modules never import the gameplay noise model, and the audio owner never
    // reports noise.
    for (const file of SOURCES) {
      const source = readFileSync(file, "utf8");
      ok(`${file} does not import the noise model`, !/from "\.\/noise"/.test(source));
    }
    const audio = readFileSync("src/game/audio.ts", "utf8");
    ok("the audio owner never imports the noise model", !/from "\.\/noise"/.test(audio));
    ok("the audio owner never reports gameplay noise",
      !audio.includes("reportEnvironmentNoise(")
      && !audio.includes("reportPlayerMovement(")
      && !audio.includes("reportPlayerLanding("));

    // Volume/asset state must not appear anywhere in the hearing model.
    const noise = readFileSync("src/game/noise.ts", "utf8");
    ok("the noise model knows nothing about volume",
      !noise.includes("masterVolume") && !noise.includes("AudioContext") && !noise.includes("GameAudio"));
    ok("the noise model does not import audio", !/from "\.\/audio/.test(noise));

    // A refused door is audible but is not a gameplay noise event.
    const doors = readFileSync("src/game/doors.ts", "utf8");
    ok("doors publish an audio cue field separate from noiseAt",
      doors.includes("audioCue") && doors.includes("noiseAt"));
    ok("a locked door carries audio but no noise",
      /audioCue: "door-locked",/.test(doors) && /noiseAt: null,\s*\n\s*audioCue: "door-locked"/.test(doors));

    // The automatic security close must be audible without reporting noise.
    const runtime = readFileSync("src/game/runtime11.ts", "utf8");
    const closeBlock = runtime.slice(runtime.indexOf("closeSecurityDoors()"), runtime.indexOf("closeSecurityDoors()") + 420);
    ok("the security close publishes audio", closeBlock.includes('publishWorldAudio("door-security-close"'));
    ok("the security close reports no gameplay noise", !closeBlock.includes("reportEnvironmentNoise("));

    // Landing keeps its gameplay threshold while every touchdown is audible.
    const character = readFileSync("src/game/character.ts", "utf8");
    ok("landing audio comes from the existing landing truth",
      character.includes('publishLocalAudio("landing"'));
    ok("the gameplay landing threshold is unchanged",
      character.includes("if (landingSpeed < LANDING_NOISE_MIN_SPEED) return;"));
    ok("landing audio is published before the noise gate",
      character.indexOf('publishLocalAudio("landing"') < character.indexOf("if (landingSpeed < LANDING_NOISE_MIN_SPEED)"));
    ok("there is still exactly one landing detector",
      (character.match(/private onLanded\(/g) ?? []).length === 1);

    // The cart's AI-hearing truth is untouched by presentation volume.
    ok("CART_NOISE_LOUDNESS remains the gameplay truth",
      readFileSync("src/game/delivery-cart.ts", "utf8").includes("export const CART_NOISE_LOUDNESS")
      && runtime.includes("reportEnvironmentNoise(at.x, at.y, at.z, CART_NOISE_LOUDNESS)"));
  }

  console.log("\n--- performance shape ---");
  {
    const audio = readFileSync("src/game/audio.ts", "utf8");
    ok("no second animation loop", !audio.includes("requestAnimationFrame"));
    ok("no per-source timer", !audio.includes("setInterval"));
    ok("no per-frame random", !audio.includes("Math.random("));
    ok("the noise buffer is generated once, not per frame",
      (audio.match(/createBuffer\(/g) ?? []).length === 1);
    ok("the voice pool is preallocated", audio.includes("MAX_SPATIAL_VOICES"));
    ok("pause suspends the context rather than juggling loops", audio.includes("context.suspend()"));
    ok("unlock is guarded against a second context", audio.includes("this.starting"));
  }

  console.log(
    failures === 0
      ? `\nAUDIO_RUNTIME_OK ${checks} checks passed`
      : `\nAUDIO_RUNTIME_FAILED ${failures} of ${checks} checks failed`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

/** Assertion used inside tight loops where per-iteration output would be noise. */
function ok_silent(condition) {
  if (!condition) {
    failures += 1;
    console.log("FAIL  voice slot out of range");
  }
}
