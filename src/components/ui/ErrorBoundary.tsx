import { Component, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY (30 Agu 2026) - dipasang di sekitar route lazy-loaded (MomFatView, dst).
// Sebelum ini, kalau lazy import() gagal (chunk gak ke-load, error di module top-level dll)
// React unmount SELURUH tree tanpa pengaman apapun - user cuma lihat layar blank/hitam total,
// gak ada info sama sekali (kejadian nyata di iOS Safari, gak ketemu penyebab pastinya karena
// gak ada cara lihat error asli dari HP user). Sekarang error ke-tangkap DI SINI, ditampilkan
// tekstual (bisa di-screenshot buat diagnosis) + tombol "Coba Lagi", TANPA nge-crash app
// yang lain.
// ─────────────────────────────────────────────────────────────────────────────
type Props={children:ReactNode,label?:string};
type State={error:Error|null};

export class ErrorBoundary extends Component<Props,State>{
  constructor(props:Props){
    super(props);
    this.state={error:null};
  }
  static getDerivedStateFromError(error:Error){
    return{error};
  }
  render(){
    if(this.state.error){
      return(
        <div style={{padding:24,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:10}}>⚠️</div>
          <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:6}}>
            Gagal memuat {this.props.label||"halaman ini"}
          </div>
          <div style={{fontSize:11.5,color:"#94a3b8",marginBottom:14,lineHeight:1.5}}>
            Coba tekan tombol di bawah. Kalau masih gagal, screenshot pesan teknis ini dan kirim ke admin:
          </div>
          <div style={{fontSize:10,color:"#dc2626",background:"#fef2f2",borderRadius:8,padding:"10px 12px",
            marginBottom:14,textAlign:"left",wordBreak:"break-word" as const,fontFamily:"monospace"}}>
            {this.state.error.message||String(this.state.error)}
          </div>
          <button onClick={()=>this.setState({error:null})}
            style={{padding:"10px 20px",borderRadius:10,border:"none",background:"#1d4ed8",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            Coba Lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
