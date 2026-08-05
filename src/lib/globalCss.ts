// CSS global - dipisah dari App.tsx (Sprint 7), dipakai Login & App (root)
// ─────────────────────────────────────────────────────────────────────────────
export const GCss=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;height:100%;overflow-x:hidden;overflow-y:auto}
body{background:#f1f5f9;color:#1e293b;font-family:'Plus Jakarta Sans',sans-serif}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:#f1f5f9}
::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
input,select,textarea,button{font-family:inherit;outline:none}
input::placeholder,textarea::placeholder{color:#94a3b8}
/* Sengaja pakai properti "translate" (bukan "transform: translateY()") buat animasi slide-nya -
   elemen dgn "transform" aktif (termasuk yang cuma berhenti di translateY(0), itu TETAP dianggap
   transform aktif, bukan "none") bikin browser nganggep elemen itu containing block baru buat
   descendant position:fixed - efeknya modal position:fixed di dalam .fi/.su (mis. Pilih Operator/
   Panel/Komponen) ke-render relatif ke elemen animasi ini alih2 ke viewport asli, jadi
   posisinya meleset jauh (apalagi kalau halaman discroll). Properti "translate" gak punya efek
   containing-block ini sama sekali, jadi hasil animasinya identik tapi bebas dari bug itu. */
@keyframes fadeIn{from{opacity:0;translate:0 6px}to{opacity:1;translate:0 0}}
@keyframes slideUp{from{opacity:0;translate:0 16px}to{opacity:1;translate:0 0}}
.fi{animation:fadeIn .25s ease forwards}
.su{animation:slideUp .2s ease forwards}
`;
