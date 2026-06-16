import type { Mesh, PhysicsShape, PhysicsShapeContainer, TransformNode } from "@babylonjs/core";

export interface PartMaterial {
  friction: number;
  staticFriction: number;
  restitution: number;
}

export function attachPart(
  root: TransformNode,
  container: PhysicsShapeContainer,
  mesh: Mesh,
  shape: PhysicsShape,
  material: PartMaterial,
  parts: Mesh[],
): void {
  mesh.parent = root;
  mesh.computeWorldMatrix(true);
  shape.material = material;
  container.addChildFromParent(root, shape, mesh);
  parts.push(mesh);
}
