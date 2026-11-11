# CLAUDE.md — Aturan Kerja Vista Pekerja (HP operator)

> **Sumber utama aturan: `C:\Users\User\vista-teknik\CLAUDE.md`.** File ini ringkasan inti +
> bagian H (agent peninjau) supaya sesi yang dibuka di repo ini memakai aturan yang sama.
> Bila ada beda, yang di vista-teknik berlaku - baca file itu untuk aturan lengkap (A-H).

Bahasa laporan/ringkasan/penjelasan ke user: **Bahasa Indonesia**.

**PENTING: push ke `main` repo ini = LIVE seketika ke operator produksi** (Vercel auto-deploy,
tanpa langkah manual). Push hanya dengan izin eksplisit user per push, dan rilis hanya di luar
jam kerja kecuali user bilang lain.

## Inti aturan (ringkas dari vista-teknik)

- **Query Supabase**: >1000 baris wajib `.range()`/`fetchAllPaged` dengan `.order('id')`. Setiap
  select/insert/update/delete/rpc wajib cek `{ error }`; jalur simpan operator wajib
  `alertGagalSimpan`, tanpa silent fail.
- **Satu sumber logika**: hitungan yang sama di 2 tempat wajib 1 helper. Cermin status admin-HP
  (`getBestProgress` dll.) wajib sama dengan vista-teknik - jalankan `npm run cek:cermin` bila
  mengubah fungsi status/progres. Tampilan tugas wajib `selesaiSebelumTanggal`
  (`panelHelpers.tsx`, cermin vista-teknik & cek K16 - ubah ketiganya bersamaan).
- **Proses spesial** (WIRING/BUSBAR/QC TEST/PACKING/NAMEPLATE/YELLOWMARK) dicek satu-satu, jangan
  asumsi satu jalur mewakili semua (vista-teknik CLAUDE.md B.2).
- **Tanggal**: filter tanggal pakai `rentangHariLokal`/`rentangBulanLokal`/`tanggalLokalDari`
  (WIB), bukan `toISOString().slice(0,10)`. Hari kerja 00.00-06.59 = hari sebelumnya.
- **Validasi duplikat** wajib exclude diri sendiri. Auto-geser/penjadwalan otomatis tidak di browser.
- **Keamanan**: jangan pernah menampilkan/menulis kredensial (ada rahasia di kode klien - jangan
  disalin). `.env.local` hanya dibaca lewat skrip yang tidak mencetak isinya.
- **Kerja dengan user**: investigasi dulu (kode + SELECT live), laporkan dengan bukti, sajikan
  rencana, tunggu konfirmasi, baru eksekusi. SQL dijalankan user sendiri (verifikasi + rollback).
  Jangan ubah rumus persen panel, aturan progres, atau jadwal tanpa izin.
- **Sebelum menyatakan selesai**: jalankan checklist E vista-teknik (8 poin) dan `npm run build`.

---

## H. AGENT PENINJAU (HANYA MEMBACA)

File di `.claude/agents/` (5 agent, semuanya `tools: Read, Grep, Glob` - tanpa Bash, tanpa tulis).
Agent hanya melapor; perbaikan menunggu konfirmasi user. Agent **tidak boleh** dipakai untuk
mengubah data atau mengeksekusi perubahan.

1. Setelah **mengubah kode**: jalankan `bug-detector` sebelum melapor selesai.
2. Bila **tampilan** berubah: `ui-reviewer`.
3. Bila menyentuh **Supabase/RPC/Edge Function/R2/login/upload**: `security-reviewer`.
4. Bila menyusun **SQL/migrasi** untuk dijalankan user: `data-migrasi-reviewer` sebelum menyerahkannya.
5. Bila menyentuh **timer/progres/jadwal/qty/status**: `regresi-penguji`. Agent utama menjalankan
   dulu `npm run build`, `npm run lint` (sebut baseline), dan `npm run cek:cermin` bila fungsi
   status/progres berubah, lalu menyerahkan output-nya ke agent (agent tidak punya Bash).
6. Ringkas hasil tiap agent di laporan: temuan, bukti, dan apa yang **tidak** diperiksa. Temuan
   DUGAAN dibuktikan agent utama (SELECT/uji) sebelum dianggap fakta.
7. **Tidak perlu dipanggil** untuk perubahan sepele: teks/label saja, komentar, file dokumentasi,
   perubahan 1-3 baris tanpa logika data. Sebutkan di laporan bahwa agent dilewati dan alasannya.
8. Bila beberapa agent relevan, jalankan bersamaan (paralel), bukan berurutan.
9. **Sumber utama** agent & bagian H ini: `vista-teknik`. Salinan di `vista-pekerja/.claude/agents/`
   wajib identik; setiap mengubah agent di sini, salin juga ke sana pada commit yang sama, lalu cek
   tidak ada beda (`git diff --no-index` kedua folder harus kosong).
