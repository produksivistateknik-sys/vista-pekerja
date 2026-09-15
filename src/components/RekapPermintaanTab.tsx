import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { VISTA_LOGO_DATA_URI } from "../lib/logoAsset";
import { EmptyState } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// TAB REKAP PERMINTAAN (dalam GudangHome, khusus divisi Gudang) - 16 Sep 2026.
// Duplikasi SENGAJA dari "Rekap per Panel" di vista-teknik (PermintaanAdminTab.tsx,
// viewMode==='rekap') - dua app ini repo Git TERPISAH TOTAL (gak ada workspace/
// monorepo), jadi gak bisa import langsung, logic query/agregasi/print HARUS
// disalin PERSIS SAMA biar hasil rekap yang dilihat Gudang di sini gak pernah
// beda dari yang dilihat admin/planner di vista-teknik untuk WO yang sama.
// KALAU logic rekap di vista-teknik berubah lagi nanti, WAJIB disinkronkan ke
// sini juga secara manual.
//
// BEDA dari vista-teknik: di sana woData sudah tersedia sebagai prop (di-fetch
// App.tsx buat seluruh app). Di sini (GudangHome) gak ada woData sama sekali -
// jadi tab ini fetch work_orders+panels sendiri, query SAMA PERSIS dengan
// workOrderService.getAll() punya vista-teknik (filter is_archived false/null).
//
// READ-ONLY MURNI - gak ada tombol edit/hapus di tab ini sama sekali, cuma lihat
// + print, sesuai permintaan (Gudang cuma butuh cetak rekap, editing kalau perlu
// tetap lewat tab Permintaan/Database yang sudah ada).
// ─────────────────────────────────────────────────────────────────────────────

const DIVISI_LABEL:Record<string,string>={
  mekanik:"Mekanik",painting:"Painting",assembling:"Assembling",
  wiring_ctrl:"Wiring Control",wiring_pwr:"Wiring Power",
  qc:"QC",nameplate:"Nameplate",komponen:"Komponen",gudang:"Gudang",
};

const fetchAllPaged=async(build:(from:number,to:number)=>any):Promise<any[]>=>{
  let all:any[]=[];
  let from=0;
  const PAGE=1000;
  while(true){
    const{data,error}=await build(from,from+PAGE-1);
    if(error)throw error;
    all=all.concat(data??[]);
    if(!data||data.length<PAGE)break;
    from+=PAGE;
  }
  return all;
};

const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

// Dipakai buat build HTML dokumen print - data dari DB ditulis mentah ke string HTML,
// WAJIB di-escape biar gak ada karakter yang kebaca sebagai tag (sama persis vista-teknik).
const escapeHtml=(s:any)=>String(s??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] as string));

export function RekapPermintaanTab(){
  // Daftar WO (16 Sep 2026) - query SAMA PERSIS workOrderService.getAll() vista-teknik
  // (filter is_archived null/false, embed panels) - cuma select kolom yang dipakai di sini.
  const[woList,setWoList]=useState<{id:number,wo:string,proyek:string,panels:{id:number,nama:string}[]}[]>([]);
  const[woLoading,setWoLoading]=useState(true);
  const[woSearch,setWoSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[scopePanelId,setScopePanelId]=useState<number|null>(null);
  const[search,setSearch]=useState("");
  const[rekapLoading,setRekapLoading]=useState(false);
  const[rawItems,setRawItems]=useState<{komponen_master_id:number|null,nama_komponen:string,satuan_dipilih:string|null,satuan:string|null,qty:number,panel_id:number,divisi:string|null}[]>([]);

  useEffect(()=>{
    const fetchWo=async()=>{
      setWoLoading(true);
      try{
        const rows=await fetchAllPaged((from,to)=>
          supabase.from("work_orders").select("id,wo,proyek,panels(id,nama)")
            .or("is_archived.is.null,is_archived.eq.false").order("created_at",{ascending:false}).range(from,to));
        setWoList(rows.map((w:any)=>({id:w.id,wo:w.wo,proyek:w.proyek,panels:Array.isArray(w.panels)?w.panels:[]})));
      }catch(e:any){
        alert("Gagal memuat daftar WO: "+e.message);
      }
      setWoLoading(false);
    };
    fetchWo();
  },[]);

  const woFiltered=useMemo(()=>{
    const q=woSearch.trim().toLowerCase();
    return woList.filter(w=>w.panels.length>0&&(!q||[w.wo,w.proyek].join(" ").toLowerCase().includes(q)))
      .sort((a,b)=>(a.wo||"").localeCompare(b.wo||""));
  },[woList,woSearch]);

  const selectedWo=woList.find(w=>w.id===selectedWoId)||null;
  const panelsInWo=useMemo(()=>(selectedWo?.panels||[]).slice().sort((a,b)=>(a.nama||"").localeCompare(b.nama||"")),[selectedWo]);

  // Fetch rekap (SAMA PERSIS fetchRekap vista-teknik) - permintaan utk semua panel di WO ini,
  // lalu permintaan_item dgn status='submit' doang (item yang BENERAN sudah keluar dari Gudang,
  // bukan 'pending' yang baru disetujui admin belum tentu dipenuhi).
  const fetchRekap=async(woId:number)=>{
    setRekapLoading(true);
    try{
      const panelIds=(woList.find(w=>w.id===woId)?.panels||[]).map(p=>p.id);
      if(panelIds.length===0){setRawItems([]);setRekapLoading(false);return;}
      const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("id,panel_id,divisi").in("panel_id",panelIds).range(from,to));
      if(perms.length===0){setRawItems([]);setRekapLoading(false);return;}
      const permIds=perms.map((p:any)=>p.id);
      const permPanelMap:Record<number,number>={};
      const permDivisiMap:Record<number,string|null>={};
      perms.forEach((p:any)=>{permPanelMap[p.id]=p.panel_id;permDivisiMap[p.id]=p.divisi;});
      const itemRows=await fetchAllPaged((from,to)=>
        supabase.from("permintaan_item").select("permintaan_id,komponen_master_id,nama_komponen,satuan_dipilih,satuan,qty")
          .in("permintaan_id",permIds).eq("status","submit").range(from,to));
      setRawItems(itemRows.map((it:any)=>({...it,panel_id:permPanelMap[it.permintaan_id],divisi:permDivisiMap[it.permintaan_id]})));
    }catch(e:any){
      alert("Gagal memuat rekap: "+e.message);
    }
    setRekapLoading(false);
  };

  useEffect(()=>{
    if(selectedWoId)fetchRekap(selectedWoId);
    setScopePanelId(null);
    setSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedWoId]);

  // Agregasi SUM per divisi+komponen_master_id+satuan (SAMA PERSIS rekapRowsFull vista-teknik) -
  // divisi ikut jadi key grouping, item sama yang diminta 2 divisi beda tetap 2 baris terpisah.
  const rowsFull=useMemo(()=>{
    const rows=scopePanelId?rawItems.filter(it=>it.panel_id===scopePanelId):rawItems;
    const groups:Record<string,{nama:string,satuan:string,totalQty:number,divisi:string}>={};
    rows.forEach(it=>{
      const satuan=it.satuan_dipilih||it.satuan||"-";
      const divisi=it.divisi||"-";
      const key=`${divisi}|${it.komponen_master_id??"x"}|${satuan}`;
      if(!groups[key])groups[key]={nama:it.nama_komponen,satuan,totalQty:0,divisi};
      groups[key].totalQty+=Number(it.qty)||0;
    });
    return Object.entries(groups).map(([key,v])=>({key,...v})).sort((a,b)=>a.nama.localeCompare(b.nama));
  },[rawItems,scopePanelId]);

  const rowsDisplayed=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return rowsFull;
    return rowsFull.filter(r=>r.nama.toLowerCase().includes(q));
  },[rowsFull,search]);

  // Print - SAMA PERSIS openPrintWindow vista-teknik (window baru isi HTML mandiri, kop surat
  // PT. VISTA INTI TEKNIK + 3 kolom tanda tangan), biar dokumen yang dicetak dari sini identik
  // dengan yang dicetak admin/planner di vista-teknik.
  const openPrintWindow=()=>{
    if(!selectedWo)return;
    const rows=rowsDisplayed;
    const panelListLabel=scopePanelId
      ?(panelsInWo.find(p=>p.id===scopePanelId)?.nama||"-")
      :panelsInWo.map(p=>p.nama).join(", ");
    const judulWo=`WO ${selectedWo.wo}${scopePanelId?"":` (gabungan ${panelsInWo.length} panel)`}`;
    const html=`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Rekap Permintaan Barang - WO ${escapeHtml(selectedWo.wo)}</title>
<style>
  @page { size: A4; margin: 1.8cm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 0; }
  .kop { position: relative; display: flex; align-items: center; justify-content: center; min-height: 42px; border-bottom: 3px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 22px; }
  .kop-logo { position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: 34px; width: auto; }
  .kop-company { font-size: 21px; font-weight: 800; color: #1e293b; letter-spacing: 0.4px; text-align: center; }
  .doc-title { text-align: center; margin: 0 0 18px; }
  .doc-title h1 { font-size: 17px; font-weight: 800; letter-spacing: 1.2px; margin: 0; color: #1e3a8a; }
  .info-block { font-size: 12px; color: #334155; margin-bottom: 20px; line-height: 1.7; }
  .info-block b { color: #1e293b; display: inline-block; width: 90px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; }
  th { background: #1e3a8a; color: #fff; text-align: left; padding: 9px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  th.num, td.num { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tfoot td { padding: 9px 10px; background: #eff6ff; color: #1e3a8a; font-weight: 700; border-top: 2px solid #1e3a8a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ttd-section { margin-top: 48px; display: flex; justify-content: space-between; gap: 24px; page-break-inside: avoid; }
  .ttd-col { flex: 1; text-align: center; font-size: 12px; }
  .ttd-label { font-weight: 700; margin-bottom: 64px; }
  .ttd-line { border-top: 1px dashed #94a3b8; margin: 0 8px 6px; }
  .ttd-name { color: #64748b; font-size: 11px; }
</style>
</head>
<body>
  <div class="kop">
    <img class="kop-logo" src="${VISTA_LOGO_DATA_URI}" />
    <div class="kop-company">PT. VISTA INTI TEKNIK</div>
  </div>
  <div class="doc-title"><h1>REKAP PERMINTAAN BARANG</h1></div>
  <div class="info-block">
    <div><b>Proyek</b>: ${escapeHtml(selectedWo.proyek)}</div>
    <div><b>WO</b>: ${escapeHtml(judulWo)}</div>
    <div><b>Panel</b>: ${escapeHtml(panelListLabel)}</div>
    <div><b>Tanggal cetak</b>: ${escapeHtml(fmtDateTime(new Date().toISOString()))}</div>
  </div>
  <table>
    <thead><tr><th>Divisi</th><th>Nama Item</th><th class="num">Total Qty</th><th class="center">Satuan</th></tr></thead>
    <tbody>
      ${rows.map(r=>`<tr><td>${escapeHtml(DIVISI_LABEL[r.divisi]||r.divisi)}</td><td>${escapeHtml(r.nama)}</td><td class="num">${escapeHtml(r.totalQty.toLocaleString("id-ID"))}</td><td class="center">${escapeHtml(r.satuan)}</td></tr>`).join("")}
    </tbody>
    <tfoot><tr><td colspan="4">Total ${rows.length} jenis item</td></tr></tfoot>
  </table>
  <div class="ttd-section">
    <div class="ttd-col"><div class="ttd-label">Dibuat oleh</div><div class="ttd-line"></div><div class="ttd-name">Nama: ______________</div></div>
    <div class="ttd-col"><div class="ttd-label">Diperiksa oleh</div><div class="ttd-line"></div><div class="ttd-name">Nama: ______________</div></div>
    <div class="ttd-col"><div class="ttd-label">Disetujui oleh</div><div class="ttd-line"></div><div class="ttd-name">Nama: ______________</div></div>
  </div>
</body>
</html>`;
    const win=window.open("","_blank","width=900,height=1100");
    if(!win){alert("Popup diblokir browser - izinkan popup buat halaman ini supaya bisa print.");return;}
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload=()=>{win.focus();win.print();};
  };

  const thS:any={padding:"10px 12px",fontWeight:800,fontSize:10.5,color:"#475569",textTransform:"uppercase" as const,letterSpacing:.3,textAlign:"left" as const,whiteSpace:"nowrap" as const};
  const inputS:any={width:"100%",boxSizing:"border-box" as const,height:40,padding:"0 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:13,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit",outline:"none"};

  if(!selectedWo){
    return(
      <div style={{padding:16}}>
        <div style={{marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:15,color:"#0f172a"}}>Rekap Permintaan</div>
          <div style={{fontSize:11.5,color:"#94a3b8",marginTop:2}}>Pilih WO/proyek untuk lihat rekap item yang sudah keluar dari Gudang, digabung per jenis item.</div>
        </div>
        <input type="text" placeholder="🔍 Cari nomor WO atau nama proyek..." value={woSearch}
          onChange={(e:any)=>setWoSearch(e.target.value)} style={{...inputS,marginBottom:14}}/>
        {woLoading?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat daftar WO...</div>
        ):woFiltered.length===0?(
          <EmptyState title="WO tidak ditemukan" description={woSearch?`Tidak ada WO/proyek yang cocok dengan pencarian "${woSearch}".`:"Belum ada WO aktif yang punya panel."}/>
        ):(
          <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
            {woFiltered.map(w=>(
              <button key={w.id} onClick={()=>setSelectedWoId(w.id)}
                style={{textAlign:"left" as const,display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                  borderRadius:12,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.05)",fontFamily:"inherit"}}>
                <div style={{width:38,height:38,borderRadius:10,background:"#eff6ff",display:"flex",
                  alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>📁</div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>WO {w.wo}</div>
                  <div style={{fontSize:11.5,color:"#94a3b8"}}>{w.proyek} - {w.panels.length} panel</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{padding:16}}>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" as const,alignItems:"center"}}>
        <button onClick={()=>setSelectedWoId(null)} style={{height:36,padding:"0 14px",borderRadius:8,
          border:"1px solid #cbd5e1",background:"#fff",color:"#475569",fontSize:12.5,fontWeight:700,
          cursor:"pointer",fontFamily:"inherit"}}>← Ganti WO</button>
        <button onClick={openPrintWindow} style={{height:36,padding:"0 14px",borderRadius:8,border:"none",
          background:"#1d4ed8",color:"#fff",fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          🖨️ Print Rekap
        </button>
      </div>

      {panelsInWo.length>1&&(
        <select value={scopePanelId??""} onChange={(e:any)=>setScopePanelId(e.target.value?Number(e.target.value):null)}
          style={{...inputS,marginBottom:10,cursor:"pointer"}}>
          <option value="">Semua panel di WO ini ({panelsInWo.length})</option>
          {panelsInWo.map(p=><option key={p.id} value={p.id}>Cuma panel: {p.nama}</option>)}
        </select>
      )}
      <input type="text" placeholder="🔍 Cari nama item..." value={search}
        onChange={(e:any)=>setSearch(e.target.value)} style={{...inputS,marginBottom:14}}/>

      {/* Kop ringkas (di layar, BUKAN dokumen print - itu string HTML terpisah di openPrintWindow) */}
      <div style={{textAlign:"center" as const,padding:"14px 12px 14px",marginBottom:14,borderBottom:"2px solid #1e3a8a"}}>
        <div style={{fontSize:10.5,color:"#94a3b8",fontWeight:600,letterSpacing:.4,textTransform:"uppercase" as const}}>{selectedWo.proyek}</div>
        <div style={{fontSize:18,fontWeight:800,color:"#1e293b",marginTop:2}}>
          WO {selectedWo.wo}{scopePanelId?` — ${panelsInWo.find(p=>p.id===scopePanelId)?.nama||""}`:` (gabungan ${panelsInWo.length} panel)`}
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"#1e3a8a",marginTop:4}}>REKAP PERMINTAAN BARANG</div>
        <div style={{fontSize:10.5,color:"#94a3b8",marginTop:6}}>Item yang sudah keluar dari Gudang</div>
      </div>

      {rekapLoading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):rowsDisplayed.length===0?(
        <EmptyState title={rowsFull.length===0?"Belum ada item":"Tidak cocok dengan pencarian"}
          description={rowsFull.length===0?"Belum ada permintaan barang yang sudah keluar dari Gudang untuk cakupan ini.":`Coba kata kunci lain (pencarian: "${search}").`}/>
      ):(
        <>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12.5,minWidth:480}}>
              <thead>
                <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                  <th style={thS}>Divisi</th>
                  <th style={thS}>Nama Item</th>
                  <th style={{...thS,textAlign:"right" as const}}>Qty</th>
                  <th style={{...thS,textAlign:"center" as const}}>Satuan</th>
                </tr>
              </thead>
              <tbody>
                {rowsDisplayed.map((r,ri)=>(
                  <tr key={r.key} style={{borderBottom:ri<rowsDisplayed.length-1?"1px solid #f1f5f9":"none"}}>
                    <td style={{padding:"10px 12px",color:"#64748b",fontWeight:600,whiteSpace:"nowrap" as const}}>{DIVISI_LABEL[r.divisi]||r.divisi}</td>
                    <td style={{padding:"10px 12px",color:"#1e293b",fontWeight:600}}>{r.nama}</td>
                    <td style={{padding:"10px 12px",textAlign:"right" as const,fontWeight:700,color:"#1e293b"}}>{r.totalQty.toLocaleString("id-ID")}</td>
                    <td style={{padding:"10px 12px",textAlign:"center" as const,color:"#64748b"}}>{r.satuan}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{padding:"10px 12px",background:"#eff6ff",color:"#1d4ed8",fontWeight:700,fontSize:11.5,borderTop:"2px solid #dbeafe"}}>
                    Total {rowsDisplayed.length} jenis item{search?` (dari ${rowsFull.length} total)`:""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {search&&rowsDisplayed.length>0&&(
            <div style={{fontSize:10.5,color:"#94a3b8",marginTop:8}}>
              Menampilkan {rowsDisplayed.length} dari {rowsFull.length} item - Print akan cetak persis yang ditampilkan ini.
            </div>
          )}
        </>
      )}
    </div>
  );
}
