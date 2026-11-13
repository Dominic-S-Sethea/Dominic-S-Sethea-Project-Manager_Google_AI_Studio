import { createContext, useContext, useState, useCallback, useRef } from "react";

export interface DesignElement {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked: boolean;
  style: Record<string, string>;
  action?: string;
}

interface DesignModeState {
  isDesignMode: boolean;
  elements: DesignElement[];
  selectedId: string | null;
  history: DesignElement[][];
  historyIndex: number;
}

interface DesignModeContextValue extends DesignModeState {
  toggleDesignMode: () => void;
  setElements: (els: DesignElement[]) => void;
  addElement: (el: DesignElement) => void;
  updateElement: (id: string, updates: Partial<DesignElement>) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  lockElement: (id: string) => void;
  unlockElement: (id: string) => void;
  undo: () => void;
  redo: () => void;
  saveLayout: () => Promise<void>;
  resetLayout: () => Promise<void>;
  isLocked: boolean;
}

const DesignModeContext = createContext<DesignModeContextValue | null>(null);

export function useDesignMode() {
  const ctx = useContext(DesignModeContext);
  if (!ctx) throw new Error("useDesignMode must be used within DesignModeProvider");
  return ctx;
}

export function DesignModeProvider({ children, page }: { children: React.ReactNode; page: string }) {
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [elements, setElementsState] = useState<DesignElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<DesignElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const loadedRef = useRef(false);

  const pushHistory = useCallback((newElements: DesignElement[]) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, JSON.parse(JSON.stringify(newElements))];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const setElements = useCallback((els: DesignElement[]) => {
    setElementsState(els);
  }, []);

  const addElement = useCallback((el: DesignElement) => {
    setElementsState((prev) => {
      const next = [...prev, el];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const updateElement = useCallback((id: string, updates: Partial<DesignElement>) => {
    setElementsState((prev) => {
      const next = prev.map((el) => (el.id === id ? { ...el, ...updates } : el));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const removeElement = useCallback((id: string) => {
    setElementsState((prev) => {
      const next = prev.filter((el) => el.id !== id);
      pushHistory(next);
      return next;
    });
    setSelectedId(null);
  }, [pushHistory]);

  const duplicateElement = useCallback((id: string) => {
    setElementsState((prev) => {
      const el = prev.find((e) => e.id === id);
      if (!el) return prev;
      const dup: DesignElement = {
        ...JSON.parse(JSON.stringify(el)),
        id: `${el.id}-copy-${Date.now()}`,
        x: el.x + 20,
        y: el.y + 20,
        zIndex: Math.max(...prev.map((e) => e.zIndex)) + 1,
      };
      const next = [...prev, dup];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const selectElement = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const bringToFront = useCallback((id: string) => {
    setElementsState((prev) => {
      const maxZ = Math.max(...prev.map((e) => e.zIndex));
      const next = prev.map((el) => (el.id === id ? { ...el, zIndex: maxZ + 1 } : el));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const sendToBack = useCallback((id: string) => {
    setElementsState((prev) => {
      const minZ = Math.min(...prev.map((e) => e.zIndex));
      const next = prev.map((el) => (el.id === id ? { ...el, zIndex: minZ - 1 } : el));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const lockElement = useCallback((id: string) => {
    setElementsState((prev) => {
      const next = prev.map((el) => (el.id === id ? { ...el, locked: true } : el));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const unlockElement = useCallback((id: string) => {
    setElementsState((prev) => {
      const next = prev.map((el) => (el.id === id ? { ...el, locked: false } : el));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setElementsState(JSON.parse(JSON.stringify(history[newIndex])));
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setElementsState(JSON.parse(JSON.stringify(history[newIndex])));
  }, [history, historyIndex]);

  const toggleDesignMode = useCallback(() => {
    setIsDesignMode((prev) => !prev);
    if (isDesignMode) {
      setSelectedId(null);
    }
  }, [isDesignMode]);

  const saveLayout = useCallback(async () => {
    const token = localStorage.getItem("pm_token");
    await fetch(`/api/ui-layout/${page}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ elements, is_locked: true }),
    });
    setIsLocked(true);
    setIsDesignMode(false);
    setSelectedId(null);
  }, [page, elements]);

  const resetLayout = useCallback(async () => {
    const token = localStorage.getItem("pm_token");
    await fetch(`/api/ui-layout/${page}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setElementsState([]);
    setIsLocked(false);
  }, [page]);

  // Load layout on mount
  useState(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const token = localStorage.getItem("pm_token");
    fetch(`/api/ui-layout/${page}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.layout) {
          setElementsState(data.layout.elements || []);
          setIsLocked(!!data.layout.is_locked);
        }
      })
      .catch(() => {});
  });

  const value: DesignModeContextValue = {
    isDesignMode,
    elements,
    selectedId,
    history,
    historyIndex,
    toggleDesignMode,
    setElements,
    addElement,
    updateElement,
    removeElement,
    duplicateElement,
    selectElement,
    bringToFront,
    sendToBack,
    lockElement,
    unlockElement,
    undo,
    redo,
    saveLayout,
    resetLayout,
    isLocked,
  };

  return <DesignModeContext.Provider value={value}>{children}</DesignModeContext.Provider>;
}
