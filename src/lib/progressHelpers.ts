// Helper progress/urgensi panel & status tugas - dipakai bareng QCChecklistTab/
// NameplateView/KomponenProgressView - dipisah dari App.tsx (Sprint 7)
// ─────────────────────────────────────────────────────────────────────────────
export const getUrgensiPanel=(target:string|undefined)=>{
  if(!target)return{level:"normal",label:"",hari:null};
  const hari=Math.ceil((new Date(target).getTime()-new Date().getTime())/86400000);
  if(hari<0)return{level:"telat",label:`Telat ${Math.abs(hari)}hr`,hari};
  if(hari<=3)return{level:"mendesak",label:`H-${hari}`,hari};
  if(hari<=7)return{level:"perhatian",label:`H-${hari}`,hari};
  return{level:"normal",label:`H-${hari}`,hari};
};
export const fmtTanggalDeadlineNp=(target:string)=>new Date(target).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});

export const STATUS_TUGAS_NP:Record<string,{label:string,bg:string,color:string}>={
  belum:{label:"Belum Mulai",bg:"#f1f5f9",color:"#64748b"},
  proses:{label:"Sedang Dikerjakan",bg:"#fef9c3",color:"#a16207"},
  selesai:{label:"Selesai",bg:"#dcfce7",color:"#16a34a"},
};
