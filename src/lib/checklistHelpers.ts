import { supabase } from "./supabase";

// mergePanelChecklist (31 Agu 2026) - root cause "qty komponen hilang lagi" (Kompartemen/
// Hanger MCC TR 4/5): dulu tiap edit qty/progress kirim SELURUH panels.checklist dari state
// lokal browser (`{...panel.checklist,[kode]:{...}}` lalu `.update({checklist:...})`) - kalau
// tab operator udah lama kebuka (checklist versi lama nempel di memori) pas ada perbaikan di
// komponen LAIN dari sisi manapun, edit apapun oleh operator itu diam-diam nimpa balik semua
// komponen lain ke versi lama. RPC merge_panel_checklist di server cuma sentuh kode yang
// benar-benar disertakan di partial (jsonb `||` shallow merge) - kode lain gak pernah ketulis.
export const mergePanelChecklist=(panelId:number,partial:Record<string,any>)=>
  supabase.rpc("merge_panel_checklist",{p_panel_id:panelId,p_partial:partial});
