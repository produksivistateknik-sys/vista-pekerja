import { supabase } from "./supabase";

// mergePanelChecklist (31 Agu 2026) - root cause "qty komponen hilang lagi" (Kompartemen/
// Hanger MCC TR 4/5): dulu tiap edit qty/progress kirim SELURUH panels.checklist dari state
// lokal browser (`{...panel.checklist,[kode]:{...}}` lalu `.update({checklist:...})`) - kalau
// tab operator udah lama kebuka (checklist versi lama nempel di memori) pas ada perbaikan di
// komponen LAIN dari sisi manapun, edit apapun oleh operator itu diam-diam nimpa balik semua
// komponen lain ke versi lama. RPC merge_panel_checklist di server cuma sentuh kode yang
// benar-benar disertakan di partial (jsonb `||` shallow merge) - kode lain gak pernah ketulis.
// CATATAN (2 Okt 2026): masih dipertahankan utk kompatibilitas, jalur simpan operator sekarang
// pakai mergePanelChecklistDalam di bawah.
export const mergePanelChecklist=(panelId:number,partial:Record<string,any>)=>
  supabase.rpc("merge_panel_checklist",{p_panel_id:panelId,p_partial:partial});

// ─────────────────────────────────────────────────────────────────────────────
// SIMPAN PER PROSES (2 Okt 2026, insiden 30 Sep P-VAC 2A WM.4: RAKIT 100% hilang ditimpa Simpan
// Section PAINTING dari HP yang datanya basi). merge_panel_checklist mengganti SELURUH entri
// komponen (semua proses) dgn salinan lokal operator. Sekarang SEMUA jalur simpan operator lewat
// mergePanelChecklistDalam: helper buatPatchKomponen membandingkan entri komponen sebelum & sesudah
// diubah lalu cuma mengirim bagian yang BERUBAH (kolom -> kunci proses/tahap/tanggal), dan RPC
// merge_panel_checklist_dalam (migration vista-teknik 20261002070000) menggabungkannya di server
// per kunci. Simpan PAINTING tidak pernah lagi menyentuh progress.RAKIT dst.
// Kunci yang dihapus dikirim null (RPC membuangnya). SATU-SATUNYA pintu simpan checklist operator.
// ─────────────────────────────────────────────────────────────────────────────
const isObj=(v:any)=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const sama=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);

export function buatPatchKomponen(lama:any,baru:any):Record<string,any>{
  const L=isObj(lama)?lama:{};
  const B=isObj(baru)?baru:{};
  const patch:Record<string,any>={};
  for(const f of Object.keys(B)){
    const a=L[f],b=B[f];
    if(sama(a,b))continue;
    if(isObj(a)&&isObj(b)){
      const sub:Record<string,any>={};
      for(const k of Object.keys(b))if(!sama(a[k],b[k]))sub[k]=b[k]===undefined?null:b[k];
      for(const k of Object.keys(a))if(!(k in b))sub[k]=null;
      if(Object.keys(sub).length)patch[f]=sub;
    }else{
      patch[f]=b===undefined?null:b;
    }
  }
  for(const f of Object.keys(L))if(!(f in B))patch[f]=null;
  return patch;
}

// perubahan: {kode: {lama: entri sebelum diubah, baru: entri sesudah diubah}}. Tidak ada yang
// berubah -> tidak ada request (dianggap sukses).
export const mergePanelChecklistDalam=async(panelId:number,perubahan:Record<string,{lama:any;baru:any}>):Promise<{data:any;error:any}>=>{
  const patch:Record<string,any>={};
  for(const[kode,{lama,baru}] of Object.entries(perubahan)){
    const p=buatPatchKomponen(lama,baru);
    if(Object.keys(p).length)patch[kode]=p;
  }
  if(!Object.keys(patch).length)return{data:null,error:null};
  const{data,error}=await supabase.rpc("merge_panel_checklist_dalam" as any,{p_panel_id:panelId,p_patch:patch} as any);
  return{data,error};
};
