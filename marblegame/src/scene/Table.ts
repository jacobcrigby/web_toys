import {
  Color3,
  CreateBox,
  PBRMaterial,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsPrestepType,
  PhysicsShapeBox,
  PhysicsShapeContainer,
  Quaternion,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Mesh,
  type PhysicsShape,
  type Scene,
} from "@babylonjs/core";
import { GameConfig } from "../config/GameConfig";
import { attachPart } from "./compoundPart";
import { populateObstacles } from "./TestObjects";
import type { TiltIntent } from "../input/TiltIntent";

export class Table {
  private readonly root: TransformNode;
  private readonly container: PhysicsShapeContainer;
  private readonly parts: Mesh[] = [];
  private readonly material: PBRMaterial;
  private targetTiltX = 0;
  private targetTiltZ = 0;

  constructor(private readonly scene: Scene) {
    this.root = new TransformNode("tableRoot", scene);
    this.root.rotationQuaternion = Quaternion.Identity();
    this.container = new PhysicsShapeContainer(scene);
    this.material = this.buildMaterial();

    this.buildSurface();
    this.buildWalls();
    populateObstacles(this.scene, this.root, this.container, this.parts);

    const body = new PhysicsBody(this.root, PhysicsMotionType.ANIMATED, false, this.scene);
    body.shape = this.container;
    body.setMassProperties({ mass: 0 });
    body.disablePreStep = false;
    body.setPrestepType(PhysicsPrestepType.ACTION);
  }

  get meshes(): AbstractMesh[] {
    return this.parts;
  }

  setTilt(intent: TiltIntent): void {
    const max = GameConfig.table.maxTiltAngle;
    this.targetTiltX = intent.x * max;
    this.targetTiltZ = intent.z * max;
  }

  level(): void {
    this.targetTiltX = 0;
    this.targetTiltZ = 0;
  }

  update(): void {
    const target = Quaternion.RotationYawPitchRoll(0, this.targetTiltX, this.targetTiltZ);
    const current = this.root.rotationQuaternion!;
    const angle = 2 * Math.acos(Math.min(1, Math.abs(Quaternion.Dot(current, target))));
    const maxStep = GameConfig.table.maxTiltSpeed * (GameConfig.physics.fixedTimeStepMs / 1000);
    const t = angle > maxStep ? maxStep / angle : 1;
    Quaternion.SlerpToRef(current, target, t, current);
    this.root.computeWorldMatrix(true);
  }

  private buildMaterial(): PBRMaterial {
    const material = new PBRMaterial("tableMat", this.scene);
    material.albedoColor = new Color3(0.22, 0.24, 0.28);
    material.metallic = 0.1;
    material.roughness = 0.6;
    return material;
  }

  private buildSurface(): void {
    const { size, thickness } = GameConfig.table;
    const surface = CreateBox("tableSurface", { width: size, depth: size, height: thickness }, this.scene);
    surface.material = this.material;
    surface.position.set(0, -thickness / 2, 0);
    const shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(size, thickness, size), this.scene);
    this.addPart(surface, shape);
  }

  private buildWalls(): void {
    const { size, wallHeight, wallThickness } = GameConfig.table;
    const half = size / 2;
    const length = size + wallThickness;
    const y = wallHeight / 2;

    const configs: Array<{ pos: Vector3; w: number; d: number }> = [
      { pos: new Vector3(0, y, half), w: length, d: wallThickness },
      { pos: new Vector3(0, y, -half), w: length, d: wallThickness },
      { pos: new Vector3(half, y, 0), w: wallThickness, d: length },
      { pos: new Vector3(-half, y, 0), w: wallThickness, d: length },
    ];

    configs.forEach((cfg, i) => {
      const wall = CreateBox(`wall${i}`, { width: cfg.w, depth: cfg.d, height: wallHeight }, this.scene);
      wall.material = this.material;
      wall.position.copyFrom(cfg.pos);
      const shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(cfg.w, wallHeight, cfg.d), this.scene);
      this.addPart(wall, shape);
    });
  }

  private addPart(mesh: Mesh, shape: PhysicsShape): void {
    const { friction, staticFriction, restitution } = GameConfig.table;
    attachPart(this.root, this.container, mesh, shape, { friction, staticFriction, restitution }, this.parts);
  }
}
