// Baca SEMUA baris lewat .range() per 1000 (batas PostgREST) - 15 Okt 2026, audit paginasi (aturan A.1/A.2).
// `build(dari, sampai)` WAJIB meneruskan ke .range() dan punya .order() deterministik (tambah .order("id")).
// Error DILEMPAR - pemanggil memutuskan (jangan pernah memasang data setengah).
//
// 18 Okt 2026 (audit K5 permintaan_item) - jadi SATU-SATUNYA helper paginasi aplikasi operator: 9 salinan
// lokal `fetchAllPaged` yang identik (ArsipQC, ArsipSeksi, PermintaanGudang, PermintaanView, RekapPermintaan,
// RiwayatGudang, TarikGudang, WoDigital, useWoEngineeringBroadcast) diganti import dari sini.
// - Server memotong SETIAP request di 1000 baris walau diminta .range(0,9999) (terbukti live 18 Okt).
// - Tanpa .order() server mengembalikan baris sesuai letak fisik -> halaman 2 dst bisa melompati/menggandakan
//   baris kalau ada baris yang berubah di tengah pembacaan. Mode dev memberi peringatan kalau lupa.
// - Daftar id panjang untuk .in() dipecah per 200 (bacaSemuaPerPotongan) - URL tetap pendek (server mengulang
//   URL di header Content-Location).
export const UKURAN_HALAMAN = 1000;
export const UKURAN_POTONGAN_ID = 200;

const sudahDiperingatkan = new Set<string>();
function peringatkanTanpaUrutan(q: any) {
  if (!import.meta.env?.DEV) return;
  try {
    const url: URL | undefined = q?.url;
    if (url && !url.searchParams.has("order") && !sudahDiperingatkan.has(url.pathname)) {
      sudahDiperingatkan.add(url.pathname);
      console.warn("[bacaSemua] query tanpa .order() - paginasi tidak stabil:", url.pathname);
    }
  } catch { /* peringatan dev saja */ }
}

export async function bacaSemuaHalaman(build: (dari: number, sampai: number) => any): Promise<any[]> {
  const semua: any[] = [];
  for (let dari = 0; ; dari += UKURAN_HALAMAN) {
    const q = build(dari, dari + UKURAN_HALAMAN - 1);
    if (dari === 0) peringatkanTanpaUrutan(q);
    const { data, error } = await q;
    if (error) throw error;
    semua.push(...(data || []));
    if (!data || data.length < UKURAN_HALAMAN) return semua;
  }
}

// Nama lama yang dipakai banyak komponen - fungsi yang SAMA.
export const fetchAllPaged = bacaSemuaHalaman;

export function potongDaftar<T>(daftar: T[], ukuran = UKURAN_POTONGAN_ID): T[][] {
  const unik = [...new Set(daftar)];
  const hasil: T[][] = [];
  for (let i = 0; i < unik.length; i += ukuran) hasil.push(unik.slice(i, i + ukuran));
  return hasil;
}

// .in(kolom, ids) dgn daftar yang bisa panjang: dipecah per 200 id (duplikat dibuang), tiap potongan dibaca
// semua halamannya. `build(bagian, dari, sampai)` tetap WAJIB .order(...).range(dari, sampai).
export async function bacaSemuaPerPotongan<T>(ids: T[], build: (bagian: T[], dari: number, sampai: number) => any): Promise<any[]> {
  const hasil: any[] = [];
  for (const bagian of potongDaftar(ids)) hasil.push(...await bacaSemuaHalaman((dari, sampai) => build(bagian, dari, sampai)));
  return hasil;
}
