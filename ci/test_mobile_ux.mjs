#!/usr/bin/env node
/**
 * Focused contract tests for Milestone 09's dependency-free mobile logic.
 *
 * The Babylon runtime is intentionally not loaded here. Pointer ownership,
 * preference migration, haptics gating, look inversion and layout clamping are
 * pure contracts that can run quickly on CI without an emulator.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCES = ["src/game/mobile-ux.ts", "src/game/preferences.ts", "src/game/haptics.ts"];
let checks = 0;
let failures = 0;

function ok(label, condition, note = "") {
  checks += 1;
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${note ? ` — ${note}` : ""}`);
}

function eq(label, got, want) {
  ok(label, got === want, `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
}

function compile() {
  const outDir = mkdtempSync(join(tmpdir(), "cuma-mobile-ux-"));
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", ...SOURCES, "--outDir", outDir, "--module", "esnext", "--target", "es2022",
      "--moduleResolution", "bundler", "--skipLibCheck", "--strict", "--lib", "ES2022,DOM"],
    { stdio: "inherit", cwd: resolve(".") },
  );
  for (const name of ["mobile-ux.js", "preferences.js", "haptics.js"]) {
    const path = join(outDir, name);
    const source = readFileSync(path, "utf8");
    writeFileSync(path, source.replace(/(from\s+")(\.\/[^"]+?)(")/g, "$1$2.js$3"));
  }
  return outDir;
}

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.document = { visibilityState: "visible" };
let vibrationCalls = [];
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { vibrate: (pattern) => vibrationCalls.push(pattern) },
});

const outDir = compile();
try {
  const ux = await import(pathToFileURL(join(outDir, "mobile-ux.js")).href);
  const preferences = await import(pathToFileURL(join(outDir, "preferences.js")).href);
  const haptics = await import(pathToFileURL(join(outDir, "haptics.js")).href);

  // --- preference migration and validation ---------------------------------
  store.clear();
  store.set(preferences.GAMEPLAY_PREFERENCES_KEY, JSON.stringify({
    lookSensitivity: 1.25, audioVolume: 0.5, hudMode: "FULL",
  }));
  const migrated = preferences.loadGameplayPreferences();
  eq("old preferences keep look sensitivity", migrated.lookSensitivity, 1.25);
  eq("old preferences keep audio volume", migrated.audioVolume, 0.5);
  eq("old preferences keep HUD mode", migrated.hudMode, "FULL");
  eq("old preferences default haptics on", migrated.hapticsEnabled, true);
  eq("old preferences default standard controls", migrated.controlSize, "STANDARD");
  eq("old preferences default right handedness", migrated.controlHandedness, "RIGHT");
  eq("old preferences default non-inverted Y", migrated.invertLookY, false);

  store.set(preferences.GAMEPLAY_PREFERENCES_KEY, JSON.stringify({
    lookSensitivity: "fast", audioVolume: 2, hudMode: "broken",
    hapticsEnabled: "yes", controlSize: "HUGE", controlHandedness: "SIDEWAYS",
    invertLookY: "yes",
  }));
  const invalid = preferences.loadGameplayPreferences();
  eq("invalid sensitivity falls back independently", invalid.lookSensitivity, 1);
  eq("invalid volume falls back independently", invalid.audioVolume, 0.75);
  eq("invalid HUD falls back independently", invalid.hudMode, "COMPACT");
  eq("invalid haptics falls back independently", invalid.hapticsEnabled, true);
  eq("invalid size falls back independently", invalid.controlSize, "STANDARD");
  eq("invalid handedness falls back independently", invalid.controlHandedness, "RIGHT");
  eq("invalid invert flag falls back independently", invalid.invertLookY, false);

  const custom = {
    lookSensitivity: 1.5, audioVolume: 1, hudMode: "FULL",
    hapticsEnabled: false, controlSize: "LARGE", controlHandedness: "LEFT", invertLookY: true,
  };
  preferences.saveGameplayPreferences(custom);
  const roundTrip = preferences.loadGameplayPreferences();
  eq("preferences round-trip haptics", roundTrip.hapticsEnabled, false);
  eq("preferences round-trip size", roundTrip.controlSize, "LARGE");
  eq("preferences round-trip handedness", roundTrip.controlHandedness, "LEFT");
  eq("preferences round-trip invert Y", roundTrip.invertLookY, true);
  eq("preference storage has one owner key", [...store.keys()].join(","), preferences.GAMEPLAY_PREFERENCES_KEY);

  // --- haptics gate --------------------------------------------------------
  vibrationCalls = [];
  haptics.setHapticsEnabled(false);
  haptics.hapticTap();
  eq("haptics off produces no vibration", vibrationCalls.length, 0);
  haptics.setHapticsEnabled(true);
  haptics.hapticConfirm();
  eq("haptics on emits semantic feedback", vibrationCalls.length, 1);
  eq("haptics preserves a confirmation pattern", vibrationCalls[0].join(","), "12,22,12");
  document.visibilityState = "hidden";
  haptics.hapticTap();
  eq("hidden document produces no vibration", vibrationCalls.length, 1);
  document.visibilityState = "visible";

  // --- layout / look contracts ---------------------------------------------
  const compact = ux.controlLayoutFor("COMPACT");
  const standard = ux.controlLayoutFor("STANDARD");
  const large = ux.controlLayoutFor("LARGE");
  ok("control sizes have real increasing joystick dimensions",
    compact.joystickSize < standard.joystickSize && standard.joystickSize < large.joystickSize);
  ok("control sizes have real increasing action dimensions",
    compact.actionSize < standard.actionSize && standard.actionSize < large.actionSize);
  const normal = ux.resolveMobileControlLayout("STANDARD", 915, 412);
  eq("representative landscape standard layout is not clamped", normal.clamped, false);
  const small = ux.resolveMobileControlLayout("LARGE", 640, 360);
  eq("small landscape large layout clamps", small.clamped, true);
  ok("small layout remains separated", small.sideClearance >= 88 && small.actionWidth <= 204);
  eq("normal Y keeps sign", ux.applyLookY(4, false), 4);
  eq("inverted Y changes only sign", ux.applyLookY(4, true), -4);

  // --- pointer ownership ---------------------------------------------------
  const pointers = new ux.PointerOwnership();
  ok("joystick acquires one pointer", pointers.claim("joystick", 1));
  ok("look acquires concurrently", pointers.claim("look", 2));
  ok("action acquires alongside joystick and look",
    pointers.claim("run", 3) && pointers.claim("jump", 4));
  eq("second joystick pointer is rejected", pointers.claim("joystick", 5), false);
  eq("same pointer cannot own another action", pointers.claim("interact", 1), false);
  eq("look remains owned by its original pointer", pointers.ownerOf(2), "look");
  eq("wrong pointer cannot release look", pointers.release("look", 5), false);
  eq("cancel releases only its owner", pointers.release("look", 2), true);
  eq("joystick survives look cancel", pointers.ownerOf(1), "joystick");
  pointers.clear();
  eq("transient reset clears all ownership", pointers.size, 0);

  // --- source-level safety -------------------------------------------------
  const inputSource = readFileSync("src/game/input.ts", "utf8");
  ok("MobileInput has no MutationObserver dependency", !inputSource.includes("MutationObserver"));
  ok("MobileInput exposes explicit interaction state", inputSource.includes("setInteractionAvailable"));
  ok("MobileInput exposes explicit observation state", inputSource.includes("setObservationActive"));
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\nMOBILE_UX_FAILED ${failures}/${checks} checks failed`);
  process.exit(1);
}
console.log(`\nMOBILE_UX_OK ${checks} checks passed`);