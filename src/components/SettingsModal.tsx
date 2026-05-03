import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import "./SettingsModal.css";

type Tab = "general" | "appearance" | "text-size" | "language";

type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "error"
  | "not-configured";

interface UpdateInfo {
  version: string;
  notes: string;
}

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "text-size", label: "Text Size" },
  { id: "language", label: "Language" },
];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [version, setVersion] = useState("0.1.0");
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [hotkey, setHotkey] = useState("Control+Space");
  const [recording, setRecording] = useState(false);
  const [pendingHotkey, setPendingHotkey] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    invoke<string>("get_app_version").then(setVersion).catch(() => {});
    isEnabled().then(setLaunchAtLogin).catch(() => {});
    invoke<string>("get_saved_hotkey").then(setHotkey).catch(() => {});
  }, []);

  const handleLaunchAtLoginToggle = async (checked: boolean) => {
    try {
      if (checked) {
        await enable();
      } else {
        await disable();
      }
      setLaunchAtLogin(checked);
    } catch (e) {
      console.error("Autostart error:", e);
    }
  };

  const handleCheckUpdates = async () => {
    setUpdateStatus("checking");
    setUpdateInfo(null);
    try {
      const update = await check();
      if (update) {
        setUpdateStatus("available");
        setUpdateInfo({
          version: update.version,
          notes: update.body ?? "",
        });
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch (_e) {
      setUpdateStatus("not-configured");
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateStatus("downloading");
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (e) {
      console.error("Update failed:", e);
      setUpdateStatus("error");
    }
  };

  const startRecording = () => {
    setRecording(true);
    setPendingHotkey("Press keys…");
  };

  const cancelRecording = () => {
    setRecording(false);
    setPendingHotkey("");
  };

  const handleHotkeyKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();

      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push("Control");
      if (e.altKey) modifiers.push("Alt");
      if (e.shiftKey) modifiers.push("Shift");
      if (e.metaKey) modifiers.push("Meta");

      const ignoredKeys = ["Control", "Alt", "Shift", "Meta"];
      if (ignoredKeys.includes(e.key)) {
        setPendingHotkey(modifiers.join("+") + (modifiers.length ? "+" : "") + "…");
        return;
      }

      const keyMap: Record<string, string> = {
        " ": "Space",
        ArrowUp: "ArrowUp",
        ArrowDown: "ArrowDown",
        ArrowLeft: "ArrowLeft",
        ArrowRight: "ArrowRight",
        Escape: "Escape",
        Enter: "Enter",
        Tab: "Tab",
        Backspace: "Backspace",
        Delete: "Delete",
        F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5",
        F6: "F6", F7: "F7", F8: "F8", F9: "F9", F10: "F10",
        F11: "F11", F12: "F12",
      };

      const normalizedKey = keyMap[e.key] ?? e.key.toUpperCase();
      const newHotkey = [...modifiers, normalizedKey].join("+");

      setPendingHotkey(newHotkey);
      setRecording(false);

      try {
        await invoke("set_hotkey", { oldHotkey: hotkey, newHotkey });
        setHotkey(newHotkey);
        setPendingHotkey("");
      } catch (err) {
        console.error("Failed to set hotkey:", err);
        setPendingHotkey("");
      }
    },
    [recording, hotkey]
  );

  const updateStatusLabel = () => {
    switch (updateStatus) {
      case "checking":     return "Checking for updates…";
      case "up-to-date":   return "You're up to date.";
      case "available":    return `Update available: v${updateInfo?.version}`;
      case "downloading":  return "Downloading update…";
      case "error":        return "Update check failed.";
      case "not-configured": return "Update server not configured yet.";
      default:             return null;
    }
  };

  const displayHotkey = pendingHotkey || hotkey;

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={handleClose}>
    <div className="settings-root" onClick={(e) => e.stopPropagation()}>
      <button className="settings-close-btn" onClick={handleClose} aria-label="Close settings">✕</button>
      {/* Sidebar */}
      <nav className="settings-sidebar">
        <div className="settings-sidebar-header">
          <span className="settings-app-icon">
            <svg width="20" height="20" viewBox="0 0 53 51" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M48.4565 13.6461C47.6941 12.3965 47.5921 10.8682 48.1329 9.5063C48.1905 9.36247 48.2437 9.21865 48.2925 9.07032C48.6382 8.01403 48.7712 6.88582 48.7047 5.78009C48.4919 2.382 43.0355 -2.5983 37.2422 1.61337C37.0871 1.72574 36.8876 1.7662 36.7103 1.84261C35.3096 2.44042 33.807 2.79551 32.3133 2.52582C30.9569 2.2831 29.5651 2.15275 28.1423 2.15275C16.5513 2.15275 6.89286 10.5266 4.72093 21.6334C4.29541 23.8134 4.72093 24.2474 2.08803 27.661C-1.17035 31.8861 -1.39568 39.0066 7.14966 41.1151C9.28595 42.0669 9.61309 43.031 15.0974 46.6696C19.264 49.434 24.3303 50.9128 29.7602 50.5487C41.8476 49.7396 51.5237 39.6577 52.0113 27.3823C52.2064 22.3346 50.8766 17.6105 48.4565 13.6461ZM27.1937 10.7064C19.4989 11.1694 13.2269 17.4622 12.695 25.2607C12.07 34.4347 19.2241 42.0759 28.129 42.0669C31.6174 42.0669 34.8354 40.8938 37.424 38.916C38.2484 38.2868 38.4523 37.1316 37.9426 36.2236C37.9381 36.2191 37.9381 36.2147 37.9337 36.2102C37.1802 34.8617 36.5286 33.4234 36.3335 31.8861C36.1385 30.3534 36.4488 28.6948 37.4417 27.5171C38.4656 26.299 40.0391 25.7462 41.4575 25.0405L41.4797 25.0315C42.7031 24.4202 43.3103 22.9953 42.9025 21.6783C40.8458 15.017 34.534 10.2659 27.1937 10.7064Z"
                fill="var(--accent)"
              />
            </svg>
          </span>
          <span className="settings-app-name">OpenCraft AI</span>
        </div>
        <ul className="settings-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                className={`settings-nav-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="settings-sidebar-footer">
          <span className="settings-version">v{version}</span>
        </div>
      </nav>

      {/* Content */}
      <main className="settings-content">
        {activeTab === "general" && (
          <div className="settings-section">
            <h2 className="settings-section-title">General</h2>

            {/* App Updates */}
            <div className="settings-group">
              <h3 className="settings-group-title">App Updates</h3>
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="settings-label">Current Version</span>
                  <span className="settings-value">v{version}</span>
                </div>
              </div>
              <div className="settings-row">
                <button
                  className="btn btn-primary"
                  onClick={handleCheckUpdates}
                  disabled={updateStatus === "checking" || updateStatus === "downloading"}
                >
                  {updateStatus === "checking" ? "Checking…" : "Check for Updates"}
                </button>
                {(updateStatus === "available" || updateStatus === "downloading") && (
                  <button
                    className="btn btn-accent"
                    onClick={handleInstallUpdate}
                    disabled={updateStatus === "downloading"}
                  >
                    {updateStatus === "downloading" ? "Downloading…" : "Install Update"}
                  </button>
                )}
              </div>
              {updateStatusLabel() && (
                <p className={`settings-status ${updateStatus === "available" ? "status-success" : updateStatus === "error" ? "status-error" : "status-info"}`}>
                  {updateStatusLabel()}
                  {updateInfo?.notes && (
                    <span className="update-notes"> — {updateInfo.notes}</span>
                  )}
                </p>
              )}
            </div>

            {/* Launch at Login */}
            <div className="settings-group">
              <h3 className="settings-group-title">Startup</h3>
              <div className="settings-row settings-row-toggle">
                <div className="settings-row-info">
                  <span className="settings-label">Launch at Login</span>
                  <span className="settings-hint">Start OpenCraft AI when Windows starts</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={launchAtLogin}
                    onChange={(e) => handleLaunchAtLoginToggle(e.target.checked)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>

            {/* Global Hotkey */}
            <div className="settings-group">
              <h3 className="settings-group-title">Companion Window Hotkey</h3>
              <div className="settings-row settings-row-hotkey">
                <div className="settings-row-info">
                  <span className="settings-label">Show / Hide Shortcut</span>
                  <span className="settings-hint">
                    Press this key combination from anywhere to toggle the companion window
                  </span>
                </div>
                <div className="hotkey-capture-area">
                  <div
                    className={`hotkey-display ${recording ? "recording" : ""}`}
                    tabIndex={0}
                    onKeyDown={handleHotkeyKeyDown}
                    onBlur={cancelRecording}
                  >
                    {recording ? (
                      <span className="hotkey-text recording-pulse">{displayHotkey}</span>
                    ) : (
                      <span className="hotkey-text">{displayHotkey}</span>
                    )}
                  </div>
                  <button
                    className={`btn ${recording ? "btn-danger" : "btn-secondary"}`}
                    onClick={recording ? cancelRecording : startRecording}
                  >
                    {recording ? "Cancel" : "Change"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <div className="settings-group">
              <h3 className="settings-group-title">Theme</h3>
              <div className="settings-row settings-row-toggle">
                <div className="settings-row-info">
                  <span className="settings-label">Dark Mode</span>
                  <span className="settings-hint">Coming soon</span>
                </div>
                <label className="toggle toggle-disabled">
                  <input type="checkbox" disabled defaultChecked />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
            <div className="settings-group">
              <h3 className="settings-group-title">Accent Color</h3>
              <div className="settings-row">
                <span className="settings-hint placeholder-notice">Accent color customization coming soon.</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "text-size" && (
          <div className="settings-section">
            <h2 className="settings-section-title">Text Size</h2>
            <div className="settings-group">
              <div className="settings-row">
                <span className="settings-hint placeholder-notice">Text size controls coming soon.</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "language" && (
          <div className="settings-section">
            <h2 className="settings-section-title">Language</h2>
            <div className="settings-group">
              <div className="settings-row">
                <span className="settings-hint placeholder-notice">Language selection coming soon.</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
    </div>
  );
}
