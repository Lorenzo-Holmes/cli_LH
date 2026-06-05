import { Pencil, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import type { LaunchProfile } from "../lib/sidecar";
import type { DesktopSettings } from "../lib/storage";

export function ProfilePanel({
  profiles,
  settings,
  onApply,
  onSave,
  onRename,
  onDelete,
}: {
  profiles: LaunchProfile[];
  settings: DesktopSettings;
  onApply: (settings: DesktopSettings) => void;
  onSave: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}) {
  const [profileName, setProfileName] = useState("default");
  const [selectedName, setSelectedName] = useState("");

  const saveProfile = () => {
    onSave(profileName);
    setSelectedName(profileName.trim());
  };

  const renameProfile = () => {
    const nextName = profileName.trim();
    onRename(selectedName, nextName);
    setSelectedName(nextName);
  };

  const deleteProfile = () => {
    onDelete(selectedName);
    setSelectedName("");
  };

  return (
    <section className="panel profile-panel" id="profiles">
      <div className="panel-heading">
        <span>Profiles</span>
        <div className="panel-actions">
          <button type="button" disabled={!profileName.trim()} onClick={saveProfile}><Save size={15} /> Save</button>
          <button type="button" disabled={!selectedName || !profileName.trim()} onClick={renameProfile}><Pencil size={15} /> Rename</button>
          <button type="button" disabled={!selectedName} onClick={deleteProfile}><Trash2 size={15} /> Delete</button>
        </div>
      </div>
      <div className="field-row">
        <input value={profileName} placeholder="Profile name" onChange={(event) => setProfileName(event.target.value)} />
        <select onChange={(event) => {
          const selected = profiles.find((profile) => profile.name === event.target.value);
          setSelectedName(event.target.value);
          if (selected) {
            setProfileName(selected.name);
            onApply(selected.settings);
          }
        }} value={selectedName}>
          <option value="">Load saved...</option>
          {profiles.map((profile) => (
            <option key={profile.name} value={profile.name}>{profile.name}</option>
          ))}
        </select>
      </div>
      <p className="profile-summary">Current: {settings.baseUrl || "not configured"}</p>
    </section>
  );
}