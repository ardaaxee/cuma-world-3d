import "./styles.css";
import { GameRuntime } from "./game/runtime";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const enter = document.querySelector<HTMLButtonElement>("#enter-world");
const boot = document.querySelector<HTMLElement>("#boot");
const hud = document.querySelector<HTMLElement>("#hud");
const controls = document.querySelector<HTMLElement>("#mobile-controls");
const buildLabel = document.querySelector<HTMLElement>("#build-label");

if (!canvas || !enter || !boot || !hud || !controls || !buildLabel) {
  throw new Error("CUMA WORLD bootstrap DOM is incomplete");
}

const buildSha = (import.meta.env.VITE_BUILD_SHA || "dev").slice(0, 8);
buildLabel.textContent = `ANDROID PLAY RUNTIME · ${buildSha.toUpperCase()} · PRE-RELEASE`;

const runtime = new GameRuntime(canvas);
runtime.start();

enter.addEventListener("click", () => {
  boot.classList.add("hidden");
  hud.classList.remove("hidden");
  controls.classList.remove("hidden");
});
