import { Navigate, Route, Routes } from "react-router-dom";
import EditorPage from "./pages/EditorPage";
import LocationSelectionPage from "./pages/LocationSelectionPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LocationSelectionPage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
