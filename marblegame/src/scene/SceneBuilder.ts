import {
  ArcRotateCamera,
  Color3,
  DirectionalLight,
  HemisphericLight,
  ReflectionProbe,
  Vector3,
  type AbstractMesh,
  type BaseTexture,
  type Scene,
} from "@babylonjs/core";
import { GameConfig } from "../config/GameConfig";

export class SceneBuilder {
  private readonly camera: ArcRotateCamera;
  private readonly probe: ReflectionProbe;

  constructor(private readonly scene: Scene) {
    this.camera = this.buildCamera();
    this.buildLights();
    this.probe = this.buildEnvironment();
    this.frame();
  }

  get reflectionTexture(): BaseTexture {
    return this.probe.cubeTexture;
  }

  reflect(meshes: AbstractMesh[]): void {
    for (const mesh of meshes) this.probe.renderList?.push(mesh);
  }

  frame(): void {
    const engine = this.scene.getEngine();
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    const halfFov = Math.tan(GameConfig.camera.fov / 2);
    this.camera.radius = GameConfig.camera.frameExtent / (halfFov * Math.min(1, aspect));
  }

  private buildCamera(): ArcRotateCamera {
    const c = GameConfig.camera;
    const camera = new ArcRotateCamera(
      "camera",
      c.alpha,
      c.beta,
      c.frameExtent,
      new Vector3(c.target.x, c.target.y, c.target.z),
      this.scene,
    );
    camera.fov = c.fov;
    return camera;
  }

  private buildLights(): void {
    const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.55;
    ambient.groundColor = new Color3(0.1, 0.12, 0.16);

    const key = new DirectionalLight("key", new Vector3(-0.6, -1, 0.4), this.scene);
    key.intensity = 1.1;
    key.position = new Vector3(12, 20, -8);
  }

  private buildEnvironment(): ReflectionProbe {
    const probe = new ReflectionProbe("env", 256, this.scene);
    probe.refreshRate = 1;
    return probe;
  }
}
