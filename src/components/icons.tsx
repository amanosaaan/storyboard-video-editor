import type { CSSProperties, HTMLAttributes } from 'react';

interface EmojiIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

function emoji(symbol: string) {
  return function EmojiIcon({ size = 18, style, ...props }: EmojiIconProps) {
    const merged: CSSProperties = {
      fontSize: size,
      lineHeight: 1,
      display: 'inline-block',
      fontStyle: 'normal',
      ...style,
    };
    return (
      <span role="img" aria-hidden="true" style={merged} {...props}>
        {symbol}
      </span>
    );
  };
}

export const UploadIcon = emoji('📤');
export const RecordIcon = emoji('🎥');
export const ShapeIcon = emoji('🔷');
export const TextIcon = emoji('🔤');
export const CaptionIcon = emoji('💬');
export const PlusIcon = emoji('➕');
export const CloseIcon = emoji('✕');
export const BackIcon = emoji('←');
export const PlayIcon = emoji('▶️');
export const PauseIcon = emoji('⏸️');
export const TrashIcon = emoji('🗑️');
export const UndoIcon = emoji('↶');
export const RedoIcon = emoji('↷');
export const SearchIcon = emoji('🔍');
export const CursorIcon = emoji('👆');
export const FrameIcon = emoji('▭');
export const PaletteIcon = emoji('🎨');
export const PenIcon = emoji('✏️');
export const BringToFrontIcon = emoji('⏫');
export const SendToBackIcon = emoji('⏬');
export const AlignLeftIcon = emoji('⇤');
export const AlignCenterHIcon = emoji('↔');
export const AlignRightIcon = emoji('⇥');
export const AlignTopIcon = emoji('⤒');
export const AlignMiddleIcon = emoji('↕');
export const AlignBottomIcon = emoji('⤓');
export const RotateLeftIcon = emoji('↺');
export const RotateRightIcon = emoji('↻');
