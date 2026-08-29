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

for file in src/game/mission-feedback.ts src/game/ui-audio-feedback.ts src/game/debrief.ts; do
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

if [ "$status" -eq 0 ]; then
  echo "PRESENTATION_REGRESSION_GUARDS_OK"
fi
exit "$status"
