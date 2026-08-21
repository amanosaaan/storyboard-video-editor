import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Project, Scene } from '../domain/types';
import type { ProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { useProjectStore } from '../state/projectStore';
import { PauseIcon, PlayIcon, PlusIcon } from './icons';

interface SceneCardProps {
  scene: Scene;
  index: number;
  isSelected: boolean;
  onSelect: (sceneId: string) => void;
}

function SceneCard({ scene, index, isSelected, onSelect }: SceneCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: scene.id });
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const removeScene = useProjectStore((s) => s.removeScene);

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`scene-card${isSelected ? ' is-selected' : ''}`}
      onClick={() => onSelect(scene.id)}
    >
      <div className="scene-card__index">
        シーン {index + 1}
        {scene.transitionOut && ' 🔀'}
      </div>
      <div className="scene-card__duration">{(scene.duration / 1000).toFixed(1)}s</div>
      <div className="scene-card__actions">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const newId = duplicateScene(scene.id);
            if (newId) onSelect(newId);
          }}
        >
          複製
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeScene(scene.id);
          }}
        >
          削除
        </button>
      </div>
    </div>
  );
}

interface Props {
  project: Project;
  currentSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  engine: ProjectPlaybackEngine;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(1);
}

export function StoryboardPanel({ project, currentSceneId, onSelectScene, engine }: Props) {
  const addScene = useProjectStore((s) => s.addScene);
  const reorderScenes = useProjectStore((s) => s.reorderScenes);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = project.scenes.findIndex((s) => s.id === active.id);
    const toIndex = project.scenes.findIndex((s) => s.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    reorderScenes(fromIndex, toIndex);
  }

  function handleAddScene() {
    const newId = addScene();
    if (newId) onSelectScene(newId);
  }

  return (
    <div className="storyboard">
      <div className="storyboard__header">
        <button className="btn-icon" onClick={engine.isPlaying ? engine.pause : engine.play} aria-label="再生">
          {engine.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <input
          type="range"
          min={0}
          max={engine.totalDurationMs}
          value={engine.currentTimeMs}
          onChange={(e) => engine.seek(Number(e.target.value))}
          style={{ width: 240 }}
        />
        <span className="storyboard__time">
          {formatTime(engine.currentTimeMs)}s / {formatTime(engine.totalDurationMs)}s
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={project.scenes.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="storyboard__list">
            {project.scenes.map((scene, i) => (
              <SceneCard key={scene.id} scene={scene} index={i} isSelected={scene.id === currentSceneId} onSelect={onSelectScene} />
            ))}
            <button className="storyboard__add" onClick={handleAddScene} aria-label="シーン追加">
              <PlusIcon />
            </button>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
