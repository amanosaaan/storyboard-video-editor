import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { alignPatch, bringToFrontPatch, rotatePatch, sendToBackPatch, stepZIndexPatches } from '../domain/arrange';
import type { Layer, Project, Scene } from '../domain/types';
import { useProjectStore } from '../state/projectStore';

interface Props {
  project: Project;
  scene: Scene;
  layer: Layer | undefined;
}

export function ArrangeMenu({ project, scene, layer }: Props) {
  const [isOpen, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const updateLayer = useProjectStore((s) => s.updateLayer);

  function toggleOpen() {
    if (isOpen) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ left: rect.left, top: rect.bottom });
    setOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function run(patch: Partial<Layer>) {
    if (!layer) return;
    updateLayer(scene.id, layer.id, patch);
    setOpen(false);
  }

  function step(direction: 'forward' | 'backward') {
    if (!layer) return;
    const result = stepZIndexPatches(scene.layers, layer, direction);
    if (!result) return;
    updateLayer(scene.id, layer.id, result.targetPatch);
    updateLayer(scene.id, result.neighborId, result.neighborPatch);
    setOpen(false);
  }

  const disabled = !layer;

  return (
    <div className="menubar-dropdown">
      <button
        ref={buttonRef}
        className="editor__menubar-item"
        onClick={toggleOpen}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        配置
      </button>
      {isOpen &&
        menuPos &&
        createPortal(
          <div className="menubar-dropdown__panel" ref={panelRef} style={{ left: menuPos.left, top: menuPos.top }}>
          <button disabled={disabled} onClick={() => run(bringToFrontPatch(scene.layers))}>
            最前面へ移動
          </button>
          <button disabled={disabled} onClick={() => step('forward')}>
            前面へ移動
          </button>
          <button disabled={disabled} onClick={() => step('backward')}>
            背面へ移動
          </button>
          <button disabled={disabled} onClick={() => run(sendToBackPatch(scene.layers))}>
            最背面へ移動
          </button>
          <div className="menubar-dropdown__divider" />
          <button disabled={disabled} onClick={() => layer && run(alignPatch(project, layer, 'left'))}>
            左揃え
          </button>
          <button disabled={disabled} onClick={() => layer && run(alignPatch(project, layer, 'centerH'))}>
            左右中央揃え
          </button>
          <button disabled={disabled} onClick={() => layer && run(alignPatch(project, layer, 'right'))}>
            右揃え
          </button>
          <button disabled={disabled} onClick={() => layer && run(alignPatch(project, layer, 'top'))}>
            上揃え
          </button>
          <button disabled={disabled} onClick={() => layer && run(alignPatch(project, layer, 'centerV'))}>
            上下中央揃え
          </button>
          <button disabled={disabled} onClick={() => layer && run(alignPatch(project, layer, 'bottom'))}>
            下揃え
          </button>
          <div className="menubar-dropdown__divider" />
          <button disabled={disabled} onClick={() => layer && run(rotatePatch(layer, -90))}>
            反時計回りに回転
          </button>
            <button disabled={disabled} onClick={() => layer && run(rotatePatch(layer, 90))}>
              時計回りに回転
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
