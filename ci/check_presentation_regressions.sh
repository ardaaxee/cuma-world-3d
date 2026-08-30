#!/usr/bin/env bash
# Regression guards for the typed presentation/result contracts.
#
# These exist because `! grep -q ...` is exempt from `set -e`: a negated
# command that "fails" does NOT abort the shell, so guards written that way can
# never fail a build. Every check here tests explicitly and exits non-zero.
#
# The patterns match real usage rather than the bare word, so these modules can
# still document in comments what they deliberately no longer do.
set -uo pipefail

status=0

fail() {
  echo "REGRESSION: $1" >&2
  status=1
}

# A file must not construct a MutationObserver.
forbid_observer() {
  local file="$1"
  if grep -Eq 'new[[:space:]]+MutationObserver' "$file"; then
    fail "$file constructs a MutationObserver; it must consume typed events instead"
  fi
}

# A file must not pull gameplay state back out of display text.
forbid_text_scraping() {
  local file="$1"
  if grep -Eq '(textContent|innerText)[^;]*\.match\(|^[^*]*\btext\.match\(' "$file"; then
    fail "$file parses display text; gameplay state must arrive as typed data"
  fi
}

# A file must not import the module named, to keep a bundle chunk boundary.
forbid_import() {
  local file="$1"
  local module="$2"
  if grep -Eq "from \"\.\/${module}\"" "$file"; then
    fail "$file imports ./${module}; that would widen the bootstrap chunk"
  fi
}

for file in src/game/mission-feedback.ts src/game/debrief.ts; do
  [ -f "$file" ] || { fail "missing $file"; continue; }
  forbid_observer "$file"
  forbid_text_scraping "$file"
done

# Debrief must stay off the mission graph so the boot chunk stays small.
forbid_import src/game/debrief.ts mission

# Sprint FOV must never be driven by joystick magnitude again.
if grep -Eq 'this\.running[[:space:]]*=[[:space:]]*strength' src/game/runtime11.ts; then
  fail "sprint FOV is bound to joystick magnitude again; it must require real RUN state"
fi

# --- Milestone 07 audio guards -------------------------------------------
# Exactly one AudioContext owner. A second one would split volume ownership
# and duplicate every presentation cue.
context_owners="$(grep -rlE 'new[[:space:]]+AudioContext\(' src/ 2>/dev/null | sort || true)"
if [ "$context_owners" != "src/game/audio.ts" ]; then
  fail "AudioContext must be created only by src/game/audio.ts; found: ${context_owners:-none}"
fi
if [ "$(grep -cE 'new[[:space:]]+AudioContext\(' src/game/audio.ts || true)" != "1" ]; then
  fail "src/game/audio.ts must create exactly one AudioContext"
fi

# Audio presentation must never drive the gameplay hearing model.
for file in src/game/audio.ts src/game/audio-model.ts src/game/audio-surfaces.ts src/game/audio-events.ts; do
  [ -f "$file" ] || { fail "missing $file"; continue; }
  if grep -Eq 'from "\./noise"' "$file"; then
    fail "$file imports the gameplay noise model; audio must never drive NPC hearing"
  fi
  if grep -Eq 'report(EnvironmentNoise|PlayerMovement|PlayerLanding)\(' "$file"; then
    fail "$file reports gameplay noise; presentation audio and hearing are separate"
  fi
done

# The hearing model must never read speaker state.
if grep -Eq 'masterVolume|AudioContext|GameAudio' src/game/noise.ts; then
  fail "src/game/noise.ts reads audio state; muting must never change stealth"
fi

# Gait selection must stay deterministic.
if grep -q 'Math.random(' src/game/audio-model.ts; then
  fail "src/game/audio-model.ts uses Math.random; gait variation must be deterministic"
fi
if grep -q 'Math.random(' src/game/audio.ts; then
  fail "src/game/audio.ts uses Math.random; audio must not vary per frame randomly"
fi

# No second audio loop or per-source timer.
if grep -Eq 'requestAnimationFrame\(|setInterval\(' src/game/audio.ts; then
  fail "src/game/audio.ts starts its own loop/timer; it must run from the existing frame update"
fi

# --- Milestone 08 progression guards -------------------------------------
# The active run save has exactly one owner. A second copy of the key would
# split resume state and let replay clear only half of it.
save_key_owners="$(grep -rl '"cuma_world_android_save_v100"' src/ 2>/dev/null | sort || true)"
if [ "$save_key_owners" != "src/game/mission-save.ts" ]; then
  fail "the run save key must live only in src/game/mission-save.ts; found: ${save_key_owners:-none}"
fi

# The career profile is a separate versioned key, and equally single-owner.
progression_key_owners="$(grep -rl '"cuma_world_progression_v1"' src/ 2>/dev/null | sort || true)"
if [ "$progression_key_owners" != "src/game/progression.ts" ]; then
  fail "the progression key must live only in src/game/progression.ts; found: ${progression_key_owners:-none}"
fi

# Reset stays single-owner too, so replay can never grow a second path that
# forgets to spare the profile.
reset_owners="$(grep -rlE '^export function resetMissionProgress' src/ 2>/dev/null | sort || true)"
if [ "$reset_owners" != "src/game/mission-save.ts" ]; then
  fail "resetMissionProgress must be defined only in src/game/mission-save.ts; found: ${reset_owners:-none}"
fi

# Progression must never clear the run save, and the run save must never know
# about the profile: a corrupt one can then never destroy the other.
if grep -Eq 'removeItem\(' src/game/progression.ts; then
  fail "src/game/progression.ts deletes storage; it must never clear the active mission save"
fi
if grep -q 'cuma_world_progression' src/game/mission-save.ts; then
  fail "src/game/mission-save.ts references the progression key; the two stores must stay independent"
fi

for file in src/game/progression.ts src/game/run-telemetry.ts; do
  [ -f "$file" ] || { fail "missing $file"; continue; }
  # Storage/model layers must stay out of the world graph and the boot chunk.
  if grep -Eq 'from "@babylonjs' "$file"; then
    fail "$file imports Babylon; the progression layer must stay dependency-free"
  fi
  for module in runtime11 world world-expansion doors facility-security npc audio; do
    if grep -Eq "from \"\./${module}\"" "$file"; then
      fail "$file imports ./${module}; that would drag the world graph into the boot chunk"
    fi
  done
  # No second loop or timer: progression runs from the existing frame update.
  if grep -Eq 'requestAnimationFrame\(|setInterval\(|setTimeout\(' "$file"; then
    fail "$file starts its own loop/timer; progression must run from the existing frame update"
  fi
  # A completed run is identified by its persisted runSeed, never by chance or
  # the clock — that is what makes restoring a COMPLETE save idempotent.
  if grep -q 'Math.random(' "$file"; then
    fail "$file uses Math.random; completed-run identity must be deterministic"
  fi
  if grep -q 'Date.now(' "$file"; then
    fail "$file keys on the clock; completed-run identity must come from the run seed"
  fi
done

# Recent history and the processed-run set must both be capped where they are
# built, not merely somewhere in the file: capping only on read would still let
# the recording path grow without bound between writes.
if ! grep -Eq 'recentRuns:.*\.slice\(0, RECENT_RUN_CAP\)' src/game/progression.ts; then
  fail "src/game/progression.ts does not cap recentRuns where it records; history must never grow unbounded"
fi
if ! grep -Eq 'processedRuns:.*\.slice\(-PROCESSED_RUN_CAP\)' src/game/progression.ts; then
  fail "src/game/progression.ts does not cap processedRuns where it records; the dedupe set must stay bounded"
fi

# Telemetry must never persist live world state. These match property syntax
# (`heat:` / `heat =`) rather than the bare word, so the module can still
# explain in prose exactly which runtime state it deliberately does not keep.
for field in heat facilityHeat anchor searchAnchor npcPositions socialCooldown fieldFocus cameraState audioState; do
  if grep -Eq "(^|[^A-Za-z])${field}[[:space:]]*[:=]" src/game/run-telemetry.ts; then
    fail "src/game/run-telemetry.ts stores '$field'; live world state must stay runtime-only"
  fi
done

# The debrief reads typed progression, never the mission director.
forbid_observer src/game/progression.ts
forbid_text_scraping src/game/progression.ts

if [ "$status" -eq 0 ]; then
  echo "PRESENTATION_REGRESSION_GUARDS_OK"
fi
exit "$status"
