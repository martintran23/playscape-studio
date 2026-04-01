import { Navigate, Route, Routes } from "react-router-dom";
import EditorPage from "./pages/EditorPage";
import FocusEditorPage from "./pages/FocusEditorPage";
import LocationSelectionPage from "./pages/LocationSelectionPage";

function App() {
  return (
    <div className="h-full w-full">
      <Routes>
        <Route path="/" element={<LocationSelectionPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/focus-editor" element={<FocusEditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
