import shutil
import sys
from datetime import datetime

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def read_file():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()

def write_file(content):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def apply_edit(content, old, new, label):
    count = content.count(old)
    if count == 0:
        print(f"GAGAL [{label}]: pattern tidak ditemukan.")
        print(repr(old))
        sys.exit(1)
    if count > 1:
        print(f"GAGAL [{label}]: ditemukan {count}x.")
        sys.exit(1)
    print(f"OK [{label}]")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"Backup: {backup_path}\n")

content = read_file()

old1 = '''  const [viewDate,setViewDate]=useState(TODAY);'''

new1 = '''  const [viewDate,setViewDate]=useState(TODAY);
  const [bomPanelTypes,setBomPanelTypes]=useState<any>({});
  useEffect(()=>{
    supabase.from("bom_master").select("*").then(({data}:any)=>{
      if(!data||data.length===0)return;
      const grouped:any={};
      data.forEach((b:any)=>{
        if(!grouped[b.tipe_panel])grouped[b.tipe_panel]={};
        if(!grouped[b.tipe_panel][b.wp])grouped[b.tipe_panel][b.wp]=[];
        grouped[b.tipe_panel][b.wp].push({kode:b.kode_komponen,nama:b.nama_komponen});
      });
      const result:any={};
      Object.entries(grouped).forEach(([tipe,wpMap]:any)=>{
        const origCfg=(PANEL_TYPES as any)[tipe];
        if(!origCfg)return;
        const wps=origCfg.wps.map((origWp:any)=>{
          const items=(wpMap[origWp.wp]||[]).sort((a:any,b:any)=>String(a.kode).localeCompare(String(b.kode),undefined,{numeric:true}));
          return{...origWp,items:items.length>0?items:origWp.items};
        });
        result[tipe]={...origCfg,wps};
      });
      setBomPanelTypes(result);
    });
  },[]);
  const getEffCfg=(tipe:string)=>(bomPanelTypes?.[tipe]?.wps?.length>0)?bomPanelTypes[tipe]:(PANEL_TYPES as any)[tipe];'''

content = apply_edit(content, old1, new1, "Edit 1: State fetch bom_master getEffCfg")

old2 = '''const allItems=PANEL_TYPES[panel.tipe]?.wps.flatMap((w:any)=>w.items)||[];'''
new2 = '''const allItems=getEffCfg(panel.tipe)?.wps.flatMap((w:any)=>w.items)||[];'''
content = apply_edit(content, old2, new2, "Edit 2: Ganti PANEL_TYPES baris 1702")

old3 = '''          const panelCfg=PANEL_TYPES[panel.tipe];'''
new3 = '''          const panelCfg=getEffCfg(panel.tipe);'''
content = apply_edit(content, old3, new3, "Edit 3: Ganti PANEL_TYPES baris 2083")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
