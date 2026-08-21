import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MenubarMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface Props {
  label: string;
  items: MenubarMenuItem[];
}

export function MenubarMenu({ label, items }: Props) {
  const [isOpen, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="menubar-dropdown">
      <button
        ref={buttonRef}
        className="editor__menubar-item"
        onClick={toggleOpen}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {label}
      </button>
      {isOpen &&
        menuPos &&
        createPortal(
          <div className="menubar-dropdown__panel" ref={panelRef} style={{ left: menuPos.left, top: menuPos.top }}>
            {items.map((item) => (
              <button
                key={item.label}
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
