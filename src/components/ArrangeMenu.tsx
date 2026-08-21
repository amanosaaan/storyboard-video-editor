import {
  alignPatches,
  bringToFrontPatches,
  rotatePatches,
  sendToBackPatches,
  stepZIndexPatches,
  type LayerPatch,
} from '../domain/arrange';
import type { Layer, Project, Scene } from '../domain/types';
import { useProjectStore } from '../state/projectStore';
import { MenubarMenu } from './MenubarMenu';

interface Props {
  project: Project;
  scene: Scene;
  layers: Layer[];
}

export function ArrangeMenu({ project, scene, layers }: Props) {
  const updateLayer = useProjectStore((s) => s.updateLayer);

  function apply(results: LayerPatch[]) {
    results.forEach(({ id, patch }) => updateLayer(scene.id, id, patch));
  }

  function step(direction: 'forward' | 'backward') {
    if (layers.length !== 1) return;
    const result = stepZIndexPatches(scene.layers, layers[0], direction);
    if (!result) return;
    updateLayer(scene.id, layers[0].id, result.targetPatch);
    updateLayer(scene.id, result.neighborId, result.neighborPatch);
  }

  const disabled = layers.length === 0;
  const singleOnly = layers.length !== 1;

  const items = [
    { label: '最前面へ移動', onClick: () => apply(bringToFrontPatches(scene.layers, layers)), disabled },
    { label: '前面へ移動', onClick: () => step('forward'), disabled: disabled || singleOnly },
    { label: '背面へ移動', onClick: () => step('backward'), disabled: disabled || singleOnly },
    { label: '最背面へ移動', onClick: () => apply(sendToBackPatches(scene.layers, layers)), disabled },
    { label: '左揃え', onClick: () => apply(alignPatches(project, layers, 'left')), disabled },
    { label: '左右中央揃え', onClick: () => apply(alignPatches(project, layers, 'centerH')), disabled },
    { label: '右揃え', onClick: () => apply(alignPatches(project, layers, 'right')), disabled },
    { label: '上揃え', onClick: () => apply(alignPatches(project, layers, 'top')), disabled },
    { label: '上下中央揃え', onClick: () => apply(alignPatches(project, layers, 'centerV')), disabled },
    { label: '下揃え', onClick: () => apply(alignPatches(project, layers, 'bottom')), disabled },
    { label: '反時計回りに回転', onClick: () => apply(rotatePatches(layers, -90)), disabled },
    { label: '時計回りに回転', onClick: () => apply(rotatePatches(layers, 90)), disabled },
  ];

  return <MenubarMenu label="配置" items={items} />;
}
