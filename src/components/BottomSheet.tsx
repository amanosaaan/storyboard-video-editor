import type { ReactNode } from 'react';
import { CloseIcon } from './icons';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ title, onClose, children }: Props) {
  return (
    <div className="mobile-sheet__backdrop" onClick={onClose}>
      <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sheet__header">
          <h2>{title}</h2>
          <button className="mobile-icon-btn" onClick={onClose} aria-label="閉じる">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="mobile-sheet__body">{children}</div>
      </div>
    </div>
  );
}
