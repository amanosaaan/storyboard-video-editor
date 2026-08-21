import { useEffect } from 'react';
import { EditorView } from './components/EditorView';
import { ProjectListView } from './components/ProjectListView';
import { initAutosave } from './state/autosave';
import { useProjectStore } from './state/projectStore';

export default function App() {
  const project = useProjectStore((s) => s.project);

  useEffect(() => {
    const stop = initAutosave();
    return stop;
  }, []);

  return project ? <EditorView /> : <ProjectListView />;
}
