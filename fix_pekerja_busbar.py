from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-pekerja\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """          (task.komponen||[]).forEach((kode:string,ki:number)=>{
            const item=allItems.find((it:any)=>it.kode===kode);
            if(!item)return;
            const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{},qtyProsesByDate:{}};
            const qtyKomp=cl.qty||0;
            const qtyProses=cl.qtyProsesByDate?.[proses]?.[viewDate]??cl.qtyProses?.[proses]??0;
            const pct=getProgressOnDate(cl,proses,viewDate);
            const wpDef=panelCfg.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
            rows.push({task,panel,panelId,item,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length});
          });"""

new = """          (task.komponen||[]).forEach((kode:string,ki:number)=>{
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
          });"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Vista Pekerja busbar komponen fix added!")
else:
    print("❌ Not found!")
