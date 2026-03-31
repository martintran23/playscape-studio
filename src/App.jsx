import ModelLibraryPanel from "./components/Sidebar/ModelLibraryPanel";
import ParkScene from "./components/Scene/ParkScene";

function App() {
  return (
    <main className="flex h-full w-full">
      <ModelLibraryPanel />
      <section className="flex-1">
        <ParkScene />
      </section>
    </main>
  );
}

export default App;
