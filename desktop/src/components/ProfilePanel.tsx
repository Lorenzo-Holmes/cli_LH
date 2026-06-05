import { Save } from "lucide-react";
import { useState } from "react";
import type { LaunchProfile } from "../lib/sidecar";
import type { DesktopSettings } from "../lib/storage";

export function ProfilePanel({
  profiles,
  settings,
  onApply,
  onSave,
}: {
  profiles: LaunchProfile[];
  settings: DesktopSettings;
  onApply: (settings: DesktopSettings) => void;
  onSave: (name: string) => void;
}) {
  const [profileName, setProfileName] = useState("default");

  return (
    <section className="panel profile-panel" id="profiles">
      <div className="panel-heading">
        <span>Profiles</span>
        <button type="button" onClick={() => onSave(profileName)}><Save size={15} /> Save profile</button>
      </div>
      <div className="field-row">
        <input value={profileName} placeholder="Profile name" onChange={(event) => setProfileName(event.target.value)} />
        <select onChange={(event) => {
          const selected = profiles.find((profile) => profile.name === event.target.value);
          if (selected) {
            setProfileName(selected.name);
            onApply(selected.settings);
          }
        }} value="">
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