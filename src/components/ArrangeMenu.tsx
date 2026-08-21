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
import { MenubarMenu, type MenubarMenuItem } from './MenubarMenu';

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

  const items: MenubarMenuItem[] = [
    {
      label: '順序',
      disabled,
      items: [
        { label: '最前面に移動', disabled, onClick: () => apply(bringToFrontPatches(scene.layers, layers)) },
        { label: '前面へ移動', disabled: disabled || singleOnly, onClick: () => step('forward') },
        { label: '背面へ移動', disabled: disabled || singleOnly, onClick: () => step('backward') },
        { label: '最背面に移動', disabled, onClick: () => apply(sendToBackPatches(scene.layers, layers)) },
      ],
    },
    {
      label: '配置',
      disabled,
      items: [
        { label: '左', disabled, onClick: () => apply(alignPatches(project, layers, 'left')) },
        { label: '中央', disabled, onClick: () => apply(alignPatches(project, layers, 'centerH')) },
        { label: '右', disabled, onClick: () => apply(alignPatches(project, layers, 'right')) },
        { label: '上', disabled, onClick: () => apply(alignPatches(project, layers, 'top')) },
        { label: '中央（縦）', disabled, onClick: () => apply(alignPatches(project, layers, 'centerV')) },
        { label: '下', disabled, onClick: () => apply(alignPatches(project, layers, 'bottom')) },
      ],
    },
    { label: '整列', disabled: true },
    {
      label: 'シーンの中央',
      disabled,
      onClick: () => {
        apply(alignPatches(project, layers, 'centerH'));
        apply(alignPatches(project, layers, 'centerV'));
      },
    },
    {
      label: '回転',
      disabled,
      items: [
        { label: '反時計回りに回転', disabled, onClick: () => apply(rotatePatches(layers, -90)) },
        { label: '時計回りに回転', disabled, onClick: () => apply(rotatePatches(layers, 90)) },
      ],
    },
    { label: '', divider: true },
    { label: 'グループ化', disabled: true, shortcut: 'Ctrl+Alt+G' },
    { label: 'グループ化解除', disabled: true, shortcut: 'Ctrl+Alt+Shift+G' },
  ];

  return <MenubarMenu label="配置" items={items} />;
}
