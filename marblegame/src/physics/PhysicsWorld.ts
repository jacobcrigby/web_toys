import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin, Vector3, type Scene } from "@babylonjs/core";
import { GameConfig } from "../config/GameConfig";

export async function enablePhysics(scene: Scene): Promise<HavokPlugin> {
  const havok = await HavokPhysics();
  const plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new Vector3(0, GameConfig.gravityY, 0), plugin);

  scene.getPhysicsEngine()!.setSubTimeStep(GameConfig.physics.fixedTimeStepMs);
  plugin.setVelocityLimits(GameConfig.physics.maxLinearVelocity, GameConfig.physics.maxAngularVelocity);

  return plugin;
}
