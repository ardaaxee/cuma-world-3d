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

if [ "$status" -eq 0 ]; then
  echo "PRESENTATION_REGRESSION_GUARDS_OK"
fi
exit "$status"
