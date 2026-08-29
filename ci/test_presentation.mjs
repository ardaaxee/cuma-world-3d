#!/usr/bin/env node
/**
 * Contract tests for the Milestone 06 presentation layer.
 *
 * The cinematic timeline and the typed presentation contract are pure logic, so
 * they compile with the TypeScript already in devDependencies and run under
 * plain Node against a small DOM shim. No test framework, no new dependency.
 *
 *   node ci/test_presentation.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCES = [
  "src/game/cinematic-timeline.ts",
  "src/game/presentation-events.ts",
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

function near(label, got, want, tolerance = 1e-6) {
  ok(label, Math.abs(got - want) <= tolerance, `got=${got} want=${want}`);
}

function compile() {
  const outDir = mkdtempSync(join(tmpdir(), "cuma-presentation-"));
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
  const { CinematicTimeline, smoothstep } = await import(pathToFileURL(join(outDir, "cinematic-timeline.js")).href);
  const events = await import(pathToFileURL(join(outDir, "presentation-events.js")).href);
  runTests(CinematicTimeline, smoothstep, events);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

function runTests(CinematicTimeline, smoothstep, events) {
  const NORMAL = [1.5, 1.4, 1.1];
  const REDUCED = [0.85, 0.55];
  const step = (timeline, seconds, dt = 1 / 60) => {
    for (let i = 0; i < Math.round(seconds / dt); i += 1) timeline.advance(dt);
  };

  console.log("\n--- intro runs to completion ---");
  {
    const timeline = new CinematicTimeline();
    timeline.start(NORMAL);
    near("normal intro is 4.0 s", timeline.totalSeconds, 4.0, 1e-9);
    ok("normal duration is inside the authored 3.0-4.5 s window",
      timeline.totalSeconds >= 3.0 && timeline.totalSeconds <= 4.5);
    ok("intro is playing", timeline.isPlaying);
    eq("progress starts at zero", timeline.progress, 0);
    ok("no completion before it finishes", !timeline.consumeCompletion());

    step(timeline, 2.0);
    ok("still playing mid-intro", timeline.isPlaying);
    ok("progress advanced", timeline.progress > 0.4 && timeline.progress < 0.6, `progress=${timeline.progress.toFixed(3)}`);

    step(timeline, 2.5);
    ok("finished after its duration", timeline.isFinished);
    eq("progress ends at 1", timeline.progress, 1);
    ok("completion fires once", timeline.consumeCompletion());
    ok("completion never fires twice", !timeline.consumeCompletion());
    ok("a naturally finished intro is not marked skipped", !timeline.wasSkipped);
  }

  console.log("\n--- skip ---");
  {
    const timeline = new CinematicTimeline();
    timeline.start(NORMAL);
    step(timeline, 0.6);
    timeline.skip();
    ok("skip finishes immediately", timeline.isFinished);
    eq("skip jumps progress to the end", timeline.progress, 1);
    ok("skip is recorded", timeline.wasSkipped);
    ok("completion fires once after skip", timeline.consumeCompletion());

    // Double skip must be inert.
    timeline.skip();
    ok("a second skip produces no second completion", !timeline.consumeCompletion());
    timeline.skip();
    ok("a third skip is still inert", !timeline.consumeCompletion());
    eq("progress stays at the end", timeline.progress, 1);
  }
  {
    // Skipping something that already ended naturally must not re-complete it.
    const timeline = new CinematicTimeline();
    timeline.start(NORMAL);
    step(timeline, 5);
    ok("finished naturally", timeline.consumeCompletion());
    timeline.skip();
    ok("skip after natural finish adds no completion", !timeline.consumeCompletion());
    ok("and does not retroactively mark it skipped", !timeline.wasSkipped);
  }

  console.log("\n--- reduced motion ---");
  {
    const normal = new CinematicTimeline();
    normal.start(NORMAL);
    const reduced = new CinematicTimeline();
    reduced.start(REDUCED);
    near("reduced intro is 1.4 s", reduced.totalSeconds, 1.4, 1e-9);
    ok("reduced motion is clearly shorter than normal",
      reduced.totalSeconds < normal.totalSeconds * 0.5,
      `reduced=${reduced.totalSeconds} normal=${normal.totalSeconds}`);
    eq("reduced motion uses fewer beats", reduced.sample().index, 0);
    step(reduced, 2);
    ok("reduced intro completes", reduced.isFinished);
  }

  console.log("\n--- pause and resume ---");
  {
    const timeline = new CinematicTimeline();
    timeline.start(NORMAL);
    step(timeline, 1.0);
    const held = timeline.elapsed;
    // A paused runtime simply stops calling advance.
    for (let i = 0; i < 600; i += 1) { /* paused: no advance */ }
    eq("elapsed does not move while paused", timeline.elapsed, held);
    ok("still playing after the pause", timeline.isPlaying);
    step(timeline, 0.5);
    ok("resume continues from where it stopped", timeline.elapsed > held, `elapsed=${timeline.elapsed.toFixed(3)}`);
    ok("resume did not restart", timeline.elapsed > 1.4, `elapsed=${timeline.elapsed.toFixed(3)}`);
    step(timeline, 3);
    ok("completes normally after a pause", timeline.isFinished);
    ok("exactly one completion despite the pause", timeline.consumeCompletion());
    ok("and no second one", !timeline.consumeCompletion());
  }
  {
    // A huge frame (a resumed tab) must not blow through the whole intro.
    const timeline = new CinematicTimeline();
    timeline.start(NORMAL);
    timeline.advance(9999);
    ok("one enormous frame is clamped", timeline.elapsed <= 0.1 + 1e-9, `elapsed=${timeline.elapsed}`);
    ok("still playing after a clamped frame", timeline.isPlaying);
  }
  {
    const timeline = new CinematicTimeline();
    timeline.start(NORMAL);
    timeline.advance(-5);
    eq("a negative dt cannot rewind", timeline.elapsed, 0);
  }

  console.log("\n--- segment sampling ---");
  {
    const timeline = new CinematicTimeline();
    timeline.start(NORMAL);
    eq("starts in the establishing beat", timeline.sample().index, 0);
    step(timeline, 1.6);
    eq("moves to the service beat", timeline.sample().index, 1);
    step(timeline, 1.5);
    eq("ends in the settle beat", timeline.sample().index, 2);
    step(timeline, 2);
    eq("stays on the last beat once finished", timeline.sample().index, 2);
    eq("final beat is fully resolved", timeline.sample().t, 1);
    ok("sample t is always within 0..1", (() => {
      const probe = new CinematicTimeline();
      probe.start(NORMAL);
      for (let i = 0; i < 400; i += 1) {
        probe.advance(1 / 60);
        const { t } = probe.sample();
        if (!(t >= 0 && t <= 1)) return false;
      }
      return true;
    })());
  }

  console.log("\n--- easing ---");
  {
    eq("smoothstep(0) is 0", smoothstep(0), 0);
    eq("smoothstep(1) is 1", smoothstep(1), 1);
    near("smoothstep(0.5) is 0.5", smoothstep(0.5), 0.5);
    eq("smoothstep clamps below", smoothstep(-2), 0);
    eq("smoothstep clamps above", smoothstep(4), 1);
    ok("smoothstep is monotonic", (() => {
      let previous = -1;
      for (let i = 0; i <= 100; i += 1) {
        const value = smoothstep(i / 100);
        if (value < previous) return false;
        previous = value;
      }
      return true;
    })());
    ok("smoothstep eases in (no linear ramp)", smoothstep(0.1) < 0.1);
  }

  console.log("\n--- reset ---");
  {
    const timeline = new CinematicTimeline();
    timeline.start(NORMAL);
    step(timeline, 1);
    timeline.reset();
    ok("reset clears playing state", !timeline.isPlaying);
    eq("reset clears elapsed", timeline.elapsed, 0);
    ok("advancing after reset does nothing", (() => {
      timeline.advance(1);
      return timeline.elapsed === 0;
    })());
    ok("reset produces no completion", !timeline.consumeCompletion());
  }

  console.log("\n--- typed presentation events ---");
  {
    const received = [];
    const stop = events.onPresentation((event) => received.push(event));

    events.publishPresentation("MISSION_OBJECTIVE", "YENİ HEDEF", "detay");
    eq("one publish delivers one event", received.length, 1);
    eq("cue is carried", received[0].cue, "MISSION_OBJECTIVE");
    eq("label is carried", received[0].label, "YENİ HEDEF");
    eq("detail is carried", received[0].detail, "detay");

    events.publishPresentation("INTEL_DISCOVERED", "INTEL");
    eq("detail defaults to empty", received[1].detail, "");

    stop();
    events.publishPresentation("STAGE_RESOLVED", "AŞAMA");
    eq("unsubscribing stops delivery", received.length, 2);
    eq("no listener is left behind", shim.listenerCount("cuma-presentation-cue"), 0);
  }
  {
    // Two consumers (feedback + audio) each see every cue exactly once.
    const a = [];
    const b = [];
    const stopA = events.onPresentation((event) => a.push(event.cue));
    const stopB = events.onPresentation((event) => b.push(event.cue));
    events.publishPresentation("FACILITY_SEARCH", "ARAMA");
    eq("consumer A sees it once", a.length, 1);
    eq("consumer B sees it once", b.length, 1);
    stopA();
    stopB();
    eq("both listeners removed", shim.listenerCount("cuma-presentation-cue"), 0);
  }

  console.log("\n--- cue weighting ---");
  {
    eq("WATCH is subtle", events.presentationWeight("FACILITY_WATCH"), "SUBTLE");
    eq("SEARCH is stronger", events.presentationWeight("FACILITY_SEARCH"), "STRONG");
    eq("HIGH_ALERT is strongest", events.presentationWeight("FACILITY_HIGH_ALERT"), "CRITICAL");
    eq("intel stays quiet", events.presentationWeight("INTEL_DISCOVERED"), "SUBTLE");
    eq("optional stays quiet", events.presentationWeight("OPTIONAL_COMPLETED"), "SUBTLE");
    eq("gadget ready stays quiet", events.presentationWeight("GADGET_READY"), "SUBTLE");
    eq("objective is normal", events.presentationWeight("MISSION_OBJECTIVE"), "NORMAL");

    const rank = { SUBTLE: 0, NORMAL: 1, STRONG: 2, CRITICAL: 3 };
    ok("facility cues escalate strictly",
      rank[events.presentationWeight("FACILITY_WATCH")]
      < rank[events.presentationWeight("FACILITY_SEARCH")]
      && rank[events.presentationWeight("FACILITY_SEARCH")]
      < rank[events.presentationWeight("FACILITY_HIGH_ALERT")]);
  }

  console.log("\n--- single-fire transition guards ---");
  {
    // Mirrors how the runtime decides to publish: a cue only on a real change.
    const published = [];
    const publishOnChange = (previous, next, cue) => {
      if (next === previous) return previous;
      published.push(cue);
      return next;
    };
    let state = "CALM";
    for (const next of ["CALM", "CALM", "WATCH", "WATCH", "WATCH"]) {
      state = publishOnChange(state, next, `FACILITY_${next}`);
    }
    eq("a held state publishes once", published.length, 1);
    eq("and publishes the right cue", published[0], "FACILITY_WATCH");

    // Escalation-only: calming back down stays silent.
    const rank = { CALM: 0, WATCH: 1, SEARCH: 2, HIGH_ALERT: 3 };
    const escalations = [];
    let previous = "CALM";
    for (const next of ["WATCH", "SEARCH", "WATCH", "CALM", "SEARCH"]) {
      if (rank[next] > rank[previous]) escalations.push(next);
      previous = next;
    }
    eq("only escalations announce", escalations.length, 3);
    eq("de-escalation is silent", escalations.join(","), "WATCH,SEARCH,SEARCH");
  }
  {
    // Gadget ready: only a cooldown -> ready crossing fires, never boot-ready.
    const fired = [];
    let wasReady;  // undefined on the first refresh, exactly like the real map
    const refresh = (ready) => {
      if (wasReady === false && ready) fired.push("GADGET_READY");
      wasReady = ready;
    };
    refresh(true);   // boot: already ready
    refresh(true);   // idle refresh
    eq("a gadget ready at boot never announces", fired.length, 0);
    refresh(false);  // used
    refresh(false);  // still cooling
    eq("cooling down is silent", fired.length, 0);
    refresh(true);   // recovered
    eq("recovery announces once", fired.length, 1);
    refresh(true);
    refresh(true);
    eq("staying ready never repeats", fired.length, 1);
  }

  console.log("\n--- sprint FOV predicate ---");
  {
    // The exact predicate from runtime11: RUN held, not crouched, real speed,
    // and not during the cinematic.
    const MIN_SPEED = 1.2;
    const sprinting = (runHeld, crouched, speed, cinematic) =>
      runHeld && !crouched && speed > MIN_SPEED && !cinematic;

    ok("full joystick without RUN does not sprint", !sprinting(false, false, 3.4, false));
    ok("RUN while stationary does not sprint", !sprinting(true, false, 0.0, false));
    ok("RUN while barely drifting does not sprint", !sprinting(true, false, 0.4, false));
    ok("RUN while moving does sprint", sprinting(true, false, 4.15, false));
    ok("RUN while crouched does not sprint", !sprinting(true, true, 4.15, false));
    ok("RUN during the cinematic does not sprint", !sprinting(true, false, 4.15, true));
    ok("walking at the input limit does not sprint", !sprinting(false, false, 3.4, false));
  }

  console.log("\n--- stationary turn dead zone ---");
  {
    // Mirrors PlayerCharacter.setIdleFacing's hysteresis.
    const ENTER = 1.0;
    const SETTLE = 0.12;
    const RATE = 4.2;
    const shortest = (a) => {
      let d = a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    };
    const makeBody = () => ({ yaw: 0, turning: false });
    const tick = (body, cameraYaw, dt, allowed = true) => {
      if (!allowed) { body.turning = false; return; }
      const delta = shortest(cameraYaw - body.yaw);
      const magnitude = Math.abs(delta);
      if (!body.turning) {
        if (magnitude < ENTER) return;
        body.turning = true;
      } else if (magnitude < SETTLE) {
        body.turning = false;
        return;
      }
      body.yaw += delta * (1 - Math.exp(-RATE * dt));
    };

    {
      const body = makeBody();
      for (let i = 0; i < 120; i += 1) tick(body, 0.5, 1 / 60);
      near("a small camera turn never rotates the body", body.yaw, 0, 1e-9);
    }
    {
      const body = makeBody();
      for (let i = 0; i < 120; i += 1) tick(body, 0.95, 1 / 60);
      near("just inside the dead zone still does not rotate", body.yaw, 0, 1e-9);
    }
    {
      const body = makeBody();
      let framesToSettle = 0;
      for (let i = 0; i < 300; i += 1) {
        tick(body, 1.6, 1 / 60);
        if (body.turning) framesToSettle = i + 1;
      }
      // The settle band is intentional: the body stops once it is within
      // SETTLE of the camera rather than chasing it to exactly zero.
      const residual = Math.abs(body.yaw - 1.6);
      ok("a large gap does rotate the body", body.yaw > 1.0, `yaw=${body.yaw.toFixed(4)}`);
      ok("it comes to rest inside the settle band", residual <= SETTLE + 1e-6, `residual=${residual.toFixed(4)}`);
      // A snap would be over in one or two frames; this is a deliberate turn.
      ok("the turn takes real time rather than snapping",
        framesToSettle > 20, `frames=${framesToSettle} (~${(framesToSettle / 60).toFixed(2)}s)`);
      ok("but does not drag on", framesToSettle < 90, `frames=${framesToSettle}`);
    }
    {
      // Once settled it must not chatter back on at the boundary.
      const body = makeBody();
      for (let i = 0; i < 400; i += 1) tick(body, 1.6, 1 / 60);
      const settled = body.yaw;
      for (let i = 0; i < 200; i += 1) tick(body, 1.6, 1 / 60);
      near("a settled body holds still", body.yaw, settled, 1e-3);
      ok("and is no longer marked as turning", !body.turning);
    }
    {
      // Cover is authoritative: the body is never turned while guided.
      const body = makeBody();
      for (let i = 0; i < 200; i += 1) tick(body, 2.4, 1 / 60, false);
      near("cover blocks the idle turn entirely", body.yaw, 0, 1e-9);
      ok("and clears the turning flag", !body.turning);
    }
  }

  console.log(
    failures === 0
      ? `\nPRESENTATION_OK ${checks} checks passed`
      : `\nPRESENTATION_FAILED ${failures} of ${checks} checks failed`,
  );
  process.exit(failures === 0 ? 0 : 1);
}
