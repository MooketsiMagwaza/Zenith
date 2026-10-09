import { useEffect, useState } from "react";
import { storage } from "../platform";
import { FEATURE_KEY, migrateFeatures, type Features } from "./features";

export function useFeatures() {
  const [error, setError] = useState("");
  const [value, setValue] = useState<Features>(() => {
    try { return migrateFeatures(JSON.parse(storage.getItem(FEATURE_KEY) ?? "null")); }
    catch { return migrateFeatures(null); }
  });
  const [editable] = useState(() => {
    try { migrateFeatures(JSON.parse(storage.getItem(FEATURE_KEY) ?? "null")); return true; }
    catch { return false; }
  });
  useEffect(() => {
    if (!editable) { setError("These options use an unreadable or newer format. The saved record has been preserved."); return; }
    try { storage.setItem(FEATURE_KEY, JSON.stringify(value)); setError(""); }
    catch { setError("Options could not be saved. They apply for this visit only."); }
  }, [value, editable]);
  return { value, setValue, error, editable };
}
