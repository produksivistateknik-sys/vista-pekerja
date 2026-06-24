file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_urgensi_nameplate", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Update fetchData untuk ambil target juga
OLD1 = '''    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    const merged=(panels??[]).map((p:any)=>({...p,_wo:woMap[p.wo_id]||{}}));
    merged.sort((a:any,b:any)=>{
      const aDone=(a.nameplate_progress||0)>=100&&(a.yellowmark_progress||0)>=100;
      const bDone=(b.nameplate_progress||0)>=100&&(b.yellowmark_progress||0)>=100;
      if(aDone!==bDone)return aDone?1:-1;
      return 0;
    });'''

NEW1 = '''    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek,target").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    const merged=(panels??[]).map((p:any)=>({...p,_wo:woMap[p.wo_id]||{}}));
    const urutanLevelNp:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};
    merged.sort((a:any,b:any)=>{
      const aDone=(a.nameplate_progress||0)>=100&&(a.yellowmark_progress||0)>=100;
      const bDone=(b.nameplate_progress||0)>=100&&(b.yellowmark_progress||0)>=100;
      if(aDone!==bDone)return aDone?1:-1;
      const uA=getUrgensiPanel(a._wo?.target);const uB=getUrgensiPanel(b._wo?.target);
      const lvA=urutanLevelNp[uA.level]??3;const lvB=urutanLevelNp[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });'''
results['SORT_FETCH'] = content.count(OLD1)

# Fix 2: Tambah helper getUrgensiPanel sebelum komponen NameplateView
OLD2 = "const PROGRESS_STEPS_NP=[25,50,75,100];"
NEW2 = '''const PROGRESS_STEPS_NP=[25,50,75,100];

const getUrgensiPanel=(target:string|undefined)=>{
  if(!target)return{level:"normal",label:"",hari:null};
  const hari=Math.ceil((new Date(target).getTime()-new Date().getTime())/86400000);
  if(hari<0)return{level:"telat",label:`Telat ${Math.abs(hari)}hr`,hari};
  if(hari<=3)return{level:"mendesak",label:`H-${hari}`,hari};
  if(hari<=7)return{level:"perhatian",label:`H-${hari}`,hari};
  return{level:"normal",label:`H-${hari}`,hari};
};'''
results['HELPER'] = content.count(OLD2)

# Fix 3: Tambah badge urgensi di render card panel
OLD3 = '''                <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.nama}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>{p._wo?.proyek} \u00b7 WO {p._wo?.wo}</div>'''
NEW3 = '''                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.nama}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>{p._wo?.proyek} \u00b7 WO {p._wo?.wo}</div>
                  </div>
                  {(()=>{
                    const urg=getUrgensiPanel(p._wo?.target);
                    if(!urg.label||urg.level==="normal")return null;
                    const warnaMap:Record<string,{bg:string,color:string}>={telat:{bg:"#fef2f2",color:"#dc2626"},mendesak:{bg:"#fff7ed",color:"#ea580c"},perhatian:{bg:"#fefce8",color:"#ca8a04"}};
                    const w=warnaMap[urg.level];
                    return(<span style={{fontSize:9,fontWeight:700,background:w.bg,color:w.color,borderRadius:6,padding:"2px 7px",whiteSpace:"nowrap" as const}}>{urg.level==="telat"?"\u26a0\ufe0f ":"\u23f0 "}{urg.label}</span>);
                  })()}
                </div>'''
results['BADGE'] = content.count(OLD3)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    content = content.replace(OLD2, NEW2, 1)
    content = content.replace(OLD3, NEW3, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] NameplateView sekarang urutkan berdasarkan urgensi deadline + badge visual")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
