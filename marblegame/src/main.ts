import { GameApp } from "./core/GameApp";

const canvas = document.getElementById("renderCanvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("renderCanvas element not found");
}

void GameApp.create(canvas);
