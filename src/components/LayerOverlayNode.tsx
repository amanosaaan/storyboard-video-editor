import { useEffect, useRef } from 'react';
import { Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { Layer } from '../domain/types';

interface Props {
  layer: Layer;
  scale: number;
  isSelected: boolean;
  onSelect: (additive: boolean) => void;
  onChange: (patch: { x: number; y: number; width: number; height: number; rotation: number }) => void;
  onDoubleClick?: () => void;
  hidden?: boolean;
}

const MIN_SIZE = 10;

export function LayerOverlayNode({ layer, scale, isSelected, onSelect, onChange, onDoubleClick, hidden }: Props) {
  const shapeRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const scaledWidth = layer.width * scale;
  const scaledHeight = layer.height * scale;

  if (hidden) return null;

  return (
    <>
      <Rect
        ref={shapeRef}
        // compositor.ts はレイヤーの中心を軸に回転させる（layer.x/y は常に「未回転時の左上」）ため、
        // Konva側もオフセットを中心に合わせて同じ回転軸で動くようにする。ここを揃えないと、
        // 回転させたときに選択枠と実際の描画結果の位置がずれてしまう。
        x={(layer.x + layer.width / 2) * scale}
        y={(layer.y + layer.height / 2) * scale}
        offsetX={scaledWidth / 2}
        offsetY={scaledHeight / 2}
        width={scaledWidth}
        height={scaledHeight}
        rotation={layer.rotation}
        fill="rgba(255,255,255,0.001)"
        stroke={isSelected ? '#1a73e8' : 'rgba(255,255,255,0.5)'}
        strokeWidth={isSelected ? 2 : 1}
        dash={isSelected ? undefined : [4, 4]}
        draggable
        onClick={(e) => onSelect(e.evt.shiftKey)}
        onTap={(e) => onSelect('shiftKey' in e.evt && e.evt.shiftKey)}
        onDblClick={onDoubleClick}
        onDblTap={onDoubleClick}
        onDragEnd={(e) => {
          const node = e.target;
          onChange({
            x: node.x() / scale - layer.width / 2,
            y: node.y() / scale - layer.height / 2,
            width: layer.width,
            height: layer.height,
            rotation: layer.rotation,
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          const newWidth = Math.max(MIN_SIZE, node.width() * scaleX) / scale;
          const newHeight = Math.max(MIN_SIZE, node.height() * scaleY) / scale;
          onChange({
            x: node.x() / scale - newWidth / 2,
            y: node.y() / scale - newHeight / 2,
            width: newWidth,
            height: newHeight,
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          flipEnabled={false}
          borderStroke="#1a73e8"
          borderStrokeWidth={2}
          anchorSize={10}
          anchorCornerRadius={5}
          anchorFill="#ffffff"
          anchorStroke="#1a73e8"
          anchorStrokeWidth={2}
          rotateAnchorOffset={28}
          anchorStyleFunc={(anchorNode) => {
            if (anchorNode.hasName('rotater')) {
              anchorNode.fill('#1a73e8');
              anchorNode.stroke('#ffffff');
              anchorNode.strokeWidth(2);
              anchorNode.width(20);
              anchorNode.height(20);
              anchorNode.offsetX(10);
              anchorNode.offsetY(10);
              anchorNode.cornerRadius(10);
            }
          }}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < MIN_SIZE || newBox.height < MIN_SIZE ? oldBox : newBox
          }
        />
      )}
    </>
  );
}
