import {
  Color3,
  CreateBox,
  CreateCylinder,
  Mesh,
  PBRMaterial,
  PhysicsShapeConvexHull,
  PhysicsShapeCylinder,
  Quaternion,
  PhysicsShapeBox,
  Vector3,
  VertexData,
  type PhysicsShape,
  type PhysicsShapeContainer,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import { GameConfig } from "../config/GameConfig";
import { attachPart } from "./compoundPart";

const PART_MATERIAL = {
  friction: GameConfig.objects.friction,
  staticFriction: GameConfig.objects.staticFriction,
  restitution: GameConfig.objects.restitution,
};

export function populateObstacles(
  scene: Scene,
  root: TransformNode,
  container: PhysicsShapeContainer,
  parts: Mesh[],
): void {
  const add = (mesh: Mesh, shape: PhysicsShape): void =>
    attachPart(root, container, mesh, shape, PART_MATERIAL, parts);

  add(...box(scene, new Vector3(-4, 0.8, 3), new Color3(0.8, 0.3, 0.3)));
  add(...box(scene, new Vector3(-2, 0.8, -4), new Color3(0.3, 0.7, 0.4)));
  add(...cylinder(scene, new Vector3(4, 0.8, -3), new Color3(0.35, 0.5, 0.85)));
  add(...cylinder(scene, new Vector3(2.5, 0.8, 4), new Color3(0.85, 0.7, 0.3)));
  add(...ramp(scene, new Vector3(3.5, 0, 0.5), new Color3(0.6, 0.45, 0.75)));
}

function box(scene: Scene, position: Vector3, color: Color3): [Mesh, PhysicsShape] {
  const size = 1.6;
  const mesh = CreateBox("box", { size }, scene);
  mesh.material = material(scene, "boxMat", color);
  mesh.position.copyFrom(position);
  const shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(size, size, size), scene);
  return [mesh, shape];
}

function cylinder(scene: Scene, position: Vector3, color: Color3): [Mesh, PhysicsShape] {
  const diameter = 1.6;
  const height = 1.6;
  const mesh = CreateCylinder("cylinder", { diameter, height }, scene);
  mesh.material = material(scene, "cylinderMat", color);
  mesh.position.copyFrom(position);
  const half = height / 2;
  const shape = new PhysicsShapeCylinder(new Vector3(0, -half, 0), new Vector3(0, half, 0), diameter / 2, scene);
  return [mesh, shape];
}

function ramp(scene: Scene, position: Vector3, color: Color3): [Mesh, PhysicsShape] {
  const { length, height, depth } = GameConfig.objects.ramp;
  const mesh = wedge(scene, length, height, depth);
  const mat = material(scene, "rampMat", color);
  mat.backFaceCulling = false;
  mesh.material = mat;
  mesh.position.copyFrom(position);
  return [mesh, new PhysicsShapeConvexHull(mesh, scene)];
}

function wedge(scene: Scene, width: number, height: number, depth: number): Mesh {
  const hw = width / 2;
  const hd = depth / 2;
  const positions = [
    -hw, 0, -hd, hw, 0, -hd, -hw, height, -hd,
    -hw, 0, hd, hw, 0, hd, -hw, height, hd,
  ];
  const indices = [
    0, 2, 1,
    3, 4, 5,
    0, 1, 4, 0, 4, 3,
    2, 5, 4, 2, 4, 1,
    0, 3, 5, 0, 5, 2,
  ];
  const mesh = new Mesh("ramp", scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.applyToMesh(mesh);
  mesh.createNormals(false);
  return mesh;
}

function material(scene: Scene, name: string, color: Color3): PBRMaterial {
  const mat = new PBRMaterial(name, scene);
  mat.albedoColor = color;
  mat.metallic = 0.05;
  mat.roughness = 0.5;
  return mat;
}
