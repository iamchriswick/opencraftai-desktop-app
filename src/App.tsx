import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { LauncherView } from "./components/LauncherView";
import { SettingsModal } from "./components/SettingsModal";
import "./App.css";

function App() {
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("show-settings", () => setShowSettings(true))
      .then((fn) => { unlisten = fn; })
      .catch(console.error);
    return () => unlisten?.();
  }, []);

  return (
    <div className="app">
      <LauncherView onOpenSettings={() => setShowSettings(true)} />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
