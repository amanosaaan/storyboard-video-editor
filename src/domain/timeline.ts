import type { Project, Scene } from './types';

export function getTotalDurationMs(project: Project): number {
  return project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
}

export function getSceneStartMs(project: Project, sceneId: string): number {
  let acc = 0;
  for (const scene of project.scenes) {
    if (scene.id === sceneId) return acc;
    acc += scene.duration;
  }
  return 0;
}

export interface TimelinePosition {
  scene: Scene;
  sceneIndex: number;
  sceneStartMs: number;
  localTimeMs: number;
}

/**
 * 全体タイムライン上のミリ秒からシーンとシーン内ローカル時刻を求める。
 * ちょうど境界上の時刻は次のシーンの先頭として扱う。
 */
export function resolvePosition(project: Project, globalTimeMs: number): TimelinePosition | null {
  if (project.scenes.length === 0) return null;
  const clamped = Math.max(0, globalTimeMs);
  let acc = 0;
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    const isLast = i === project.scenes.length - 1;
    if (clamped < acc + scene.duration || isLast) {
      const localTimeMs = Math.min(Math.max(clamped - acc, 0), scene.duration);
      return { scene, sceneIndex: i, sceneStartMs: acc, localTimeMs };
    }
    acc += scene.duration;
  }
  return null;
}
