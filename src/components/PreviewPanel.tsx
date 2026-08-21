import type { RefObject } from 'react';
import { Layer as KonvaLayer, Stage } from 'react-konva';
import type Konva from 'konva';
import type { Project } from '../domain/types';
import type { ProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { useProjectStore } from '../state/projectStore';
import { LayerOverlayNode } from './LayerOverlayNode';

const DISPLAY_WIDTH = 640;

interface Props {
  project: Project;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  engine: ProjectPlaybackEngine;
}

export function PreviewPanel({ project, canvasRef, engine }: Props) {
  const updateLayer = useProjectStore((s) => s.updateLayer);
  const selectLayer = useProjectStore((s) => s.selectLayer);
  const selectedLayerIds = useProjectStore((s) => s.selectedLayerIds);

  const scale = DISPLAY_WIDTH / project.resolution.width;
  const displayHeight = project.resolution.height * scale;
  const scene = engine.position?.scene ?? null;

  const interactiveLayers = scene ? scene.layers.filter((l) => l.type === 'text' || l.type === 'shape') : [];

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target === e.target.getStage()) selectLayer(null);
  }

  return (
    <div className="scene-preview">
      <div className="scene-preview__stage" style={{ width: DISPLAY_WIDTH, height: displayHeight }}>
        <canvas
          ref={canvasRef}
          width={project.resolution.width}
          height={project.resolution.height}
          style={{ width: DISPLAY_WIDTH, height: displayHeight }}
        />
        <div className="scene-preview__overlay">
          <Stage width={DISPLAY_WIDTH} height={displayHeight} onMouseDown={handleStageMouseDown} onTouchStart={handleStageMouseDown}>
            <KonvaLayer>
              {interactiveLayers.map((layer) => (
                <LayerOverlayNode
                  key={layer.id}
                  layer={layer}
                  scale={scale}
                  isSelected={selectedLayerIds.includes(layer.id)}
                  onSelect={(additive) => selectLayer(layer.id, { additive })}
                  onChange={(patch) => scene && updateLayer(scene.id, layer.id, patch)}
                />
              ))}
            </KonvaLayer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
