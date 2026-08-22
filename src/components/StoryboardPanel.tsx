import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project, Scene, TransitionConfig } from '../domain/types';
import type { ProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { useProjectStore } from '../state/projectStore';
import { NumberField } from './NumberField';
import { PauseIcon, PlayIcon, PlusIcon, ScissorsIcon } from './icons';

const TRANSITION_OPTIONS: { type: TransitionConfig['type'] | 'none'; label: string; preview: string }[] = [
  { type: 'none', label: 'なし', preview: '—' },
  { type: 'crossfade', label: 'クロスフェード', preview: '◐' },
  { type: 'slide', label: 'スライド', preview: '→' },
  { type: 'wipe', label: 'ワイプ', preview: '▤' },
];

interface TransitionConnectorProps {
  scene: Scene;
}

function TransitionConnector({ scene }: TransitionConnectorProps) {
  const [isOpen, setOpen] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const updateScene = useProjectStore((s) => s.updateScene);
  const transitionOut = scene.transitionOut;

  function openFlyout() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setFlyoutPos({ left: rect.left + rect.width / 2, top: rect.top });
    setOpen(true);
  }

  return (
    <div className="transition-connector">
      <button
        ref={buttonRef}
        className={`transition-connector__button${transitionOut ? ' has-transition' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) setOpen(false);
          else openFlyout();
        }}
        aria-label="切り替え効果"
        title="切り替え効果"
      >
        {transitionOut ? TRANSITION_OPTIONS.find((o) => o.type === transitionOut.type)?.preview : '⇄'}
      </button>
      {isOpen &&
        flyoutPos &&
        createPortal(
          <>
            <div className="transition-flyout__backdrop" onClick={() => setOpen(false)} />
            <div
              className="transition-flyout"
              style={{ left: flyoutPos.left, top: flyoutPos.top }}
              onClick={(e) => e.stopPropagation()}
            >
            <h3>切り替え効果</h3>
            <div className="transition-flyout__grid">
              {TRANSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  className={`transition-flyout__option${
                    (transitionOut?.type ?? 'none') === opt.type ? ' is-selected' : ''
                  }`}
                  onClick={() =>
                    updateScene(scene.id, {
                      transitionOut:
                        opt.type === 'none'
                          ? undefined
                          : { type: opt.type, durationMs: transitionOut?.durationMs ?? 600 },
                    })
                  }
                >
                  <span className="transition-flyout__preview">{opt.preview}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            {transitionOut && (
              <label className="transition-flyout__duration">
                長さ (秒)
                <NumberField
                  min={0.1}
                  max={Math.max(0.1, scene.duration / 1000)}
                  step={0.1}
                  value={transitionOut.durationMs / 1000}
                  onChange={(v) =>
                    updateScene(scene.id, { transitionOut: { ...transitionOut, durationMs: Math.max(100, v * 1000) } })
                  }
                />
              </label>
            )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

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
      <div className="scene-card__index">シーン {index + 1}</div>
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
  const splitScene = useProjectStore((s) => s.splitScene);
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

  function handleSplit() {
    const position = engine.position;
    if (!position) return;
    // グローバル時刻自体は変わらないため、分割後は自動的に新しい後半シーンの先頭に位置する
    // （resolvePositionが境界ちょうどの時刻を次シーンの先頭として扱うため、seek不要）。
    splitScene(position.scene.id, position.localTimeMs);
  }

  const canSplit = !!engine.position && engine.position.localTimeMs > 0 && engine.position.localTimeMs < engine.position.scene.duration;

  return (
    <div className="storyboard">
      <div className="storyboard__header">
        <button className="btn-icon" onClick={engine.isPlaying ? engine.pause : engine.play} aria-label="再生">
          {engine.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="storyboard__time">
          {formatTime(engine.currentTimeMs)}s / {formatTime(engine.totalDurationMs)}s
        </span>
        <button
          className="btn-icon storyboard__split"
          onClick={handleSplit}
          disabled={!canSplit}
          title="再生位置でシーンを分割"
          aria-label="再生位置でシーンを分割"
        >
          <ScissorsIcon size={16} />
        </button>
      </div>
      <input
        type="range"
        className="storyboard__seekbar"
        min={0}
        max={engine.totalDurationMs}
        value={engine.currentTimeMs}
        onChange={(e) => engine.seek(Number(e.target.value))}
      />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={project.scenes.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="storyboard__list">
            {project.scenes.map((scene, i) => (
              <div className="storyboard__item" key={scene.id}>
                <SceneCard scene={scene} index={i} isSelected={scene.id === currentSceneId} onSelect={onSelectScene} />
                {i < project.scenes.length - 1 && <TransitionConnector scene={scene} />}
              </div>
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
