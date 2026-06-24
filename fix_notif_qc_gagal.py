file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_notif_qc_gagal", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''  const updateChecklistItem=async(panelId:number,itemKey:string,status:string,catatan:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{status,catatan,checked_by:user.nama,checked_at:new Date().toISOString()}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };'''

NEW = '''  const updateChecklistItem=async(panelId:number,itemKey:string,status:string,catatan:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const itemSebelumnya=panel?.qc_checklist?.[itemKey]?.status;
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{status,catatan,checked_by:user.nama,checked_at:new Date().toISOString()}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));

    // Kirim notifikasi ke planner kalau item baru ditandai Gagal (bukan sekadar update catatan saat sudah gagal)
    if(status==="gagal"&&itemSebelumnya!=="gagal"){
      const itemLabel=QC_ITEMS.find(it=>it.key===itemKey)?.label||itemKey;
      await supabase.from("fcs_notifikasi").insert({
        tipe:"qc_gagal",pekerja_nama:user.nama,
        panel_id:panelId,panel_nama:panel?.nama||"",
        kode_komponen:itemKey,nama_komponen:itemLabel,
        proses:"QC TEST",catatan:catatan||"",
      });
    }
  };'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Notifikasi qc_gagal berhasil ditambah, terkirim saat item baru ditandai Gagal")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
