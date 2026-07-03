import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''          (task.komponen||[]).forEach((kode:string,ki:number)=>{
            const isBusbarKomp=proses==="BUSBAR";
            const item=allItems.find((it:any)=>it.kode===kode);
            // Untuk BUSBAR, komponen adalah nama langsung (H-BUS, INCOMING, dll)
            if(!item&&!isBusbarKomp)return;
            const busbarItem=isBusbarKomp?{kode,nama:kode}:null;
            const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{},qtyProsesByDate:{}};
            const qtyKomp=isBusbarKomp?0:cl.qty||0;
            const qtyProses=isBusbarKomp?0:cl.qtyProsesByDate?.[proses]?.[viewDate]??cl.qtyProses?.[proses]??0;
            const pct=isBusbarKomp?(cl.progress?.[proses]||0):getProgressOnDate(cl,proses,viewDate);
            const wpDef=isBusbarKomp?null:panelCfg.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
            rows.push({task,panel,panelId,item:item||busbarItem,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:isBusbarKomp});
          });'''

NEW = '''          (task.komponen||[]).forEach((kode:string,ki:number)=>{
            // Handle token wiring khusus: __wiring_{org}org_{bobot}
            if(kode.startsWith("__wiring_")){
              const parts=kode.replace("__wiring_","").split("_");
              const org=parts[0]; // misal "1org"
              const bobot=parts.slice(1).join(" "); // misal "MEDIUM" atau "VERY HARD"
              const wiringItem={kode,nama:`⚡ Wiring ${bobot} · ${org}`};
              // Progress wiring disimpan di checklist dengan key = kode token
              const cl=panel.checklist?.[kode]||{qty:0,progress:{},progressByDate:{}};
              const pct=getProgressOnDate(cl,proses,viewDate);
              rows.push({task,panel,panelId,item:wiringItem,kode,qtyKomp:1,qtyProses:1,pct,priColor,ki,wpDef:null,
                isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:false,isWiring:true});
              return;
            }
            const isBusbarKomp=proses==="BUSBAR";
            const item=allItems.find((it:any)=>it.kode===kode);
            // Untuk BUSBAR, komponen adalah nama langsung (H-BUS, INCOMING, dll)
            if(!item&&!isBusbarKomp)return;
            const busbarItem=isBusbarKomp?{kode,nama:kode}:null;
            const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{},qtyProsesByDate:{}};
            const qtyKomp=isBusbarKomp?0:cl.qty||0;
            const qtyProses=isBusbarKomp?0:cl.qtyProsesByDate?.[proses]?.[viewDate]??cl.qtyProses?.[proses]??0;
            const pct=isBusbarKomp?(cl.progress?.[proses]||0):getProgressOnDate(cl,proses,viewDate);
            const wpDef=isBusbarKomp?null:panelCfg.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
            rows.push({task,panel,panelId,item:item||busbarItem,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:isBusbarKomp});
          });'''

def main():
    shutil.copy(PATH, PATH + ".bak_wiringrows")
    print(f"[OK] Backup dibuat: {PATH}.bak_wiringrows")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] OperatorView sekarang handle token wiring - tampil sebagai baris dengan nama panel + bobot")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
