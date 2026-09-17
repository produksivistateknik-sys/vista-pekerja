import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Banner broadcast "WO diubah Engineering" (17 Sep 2026, fitur baru) - diduplikasi kecil dari
// Vista Teknik (repo terpisah, gak bisa share modul, pola yang sama dipakai di file lain
// lintas-repo di project ini, mis. KOMPONEN_PROSES_MAP) - lihat komentar lengkap di
// vista-teknik/src/lib/useWoEngineeringBroadcast.ts. Event ditulis dari sisi Vista Teknik
// (WoDigitalTab.tsx, akun Engineering) - sisi Vista Pekerja ini CUMA baca + tandai dibaca,
// gak pernah nulis event baru.
//
// "akun" - identifier "teknik:<username admin>" atau "pekerja:<username operator>" - BUKAN
// foreign key, disusun di App.tsx dari session yang lagi login.
export type WoEngineeringEvent={
  id:number,wo_id:number|null,wo_number:string,proyek:string,
  jenis_perubahan:"tambah"|"edit",dilakukan_oleh:string,created_at:string,
}

const fetchAllPaged=async(build:(from:number,to:number)=>any):Promise<any[]>=>{
  let all:any[]=[]
  let from=0
  const PAGE=1000
  while(true){
    const{data,error}=await build(from,from+PAGE-1)
    if(error)throw error
    all=all.concat(data??[])
    if(!data||data.length<PAGE)break
    from+=PAGE
  }
  return all
}

export function useWoEngineeringBroadcast(akun:string|null){
  const[events,setEvents]=useState<WoEngineeringEvent[]>([])
  const[dibacaIds,setDibacaIds]=useState<Set<number>>(new Set())

  const fetchAll=useCallback(async()=>{
    if(!akun){setEvents([]);setDibacaIds(new Set());return}
    try{
      const[ev,db]=await Promise.all([
        fetchAllPaged((from,to)=>supabase.from("wo_engineering_events").select("*").order("created_at",{ascending:true}).range(from,to)),
        fetchAllPaged((from,to)=>supabase.from("wo_engineering_events_dibaca").select("event_id").eq("akun",akun).range(from,to)),
      ])
      setEvents(ev as WoEngineeringEvent[])
      setDibacaIds(new Set(db.map((r:any)=>r.event_id)))
    }catch{/* fetch gagal - state lama dipertahankan, realtime/mount berikutnya coba lagi */}
  },[akun])

  useEffect(()=>{
    fetchAll()
    if(!akun)return
    const ch=supabase.channel("realtime-wo-engineering-broadcast-"+akun)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"wo_engineering_events"},fetchAll)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"wo_engineering_events_dibaca"},fetchAll)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[akun,fetchAll])

  const unread=events.filter(e=>!dibacaIds.has(e.id))
  const current=unread.length>0?unread[0]:null

  const markAsRead=async(eventId:number)=>{
    if(!akun)return
    setDibacaIds(prev=>new Set(prev).add(eventId))
    await supabase.from("wo_engineering_events_dibaca").upsert({event_id:eventId,akun},{onConflict:"event_id,akun",ignoreDuplicates:true})
  }

  return{current,unreadCount:unread.length,markAsRead}
}
