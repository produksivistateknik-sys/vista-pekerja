// Baca SEMUA baris lewat .range() per 1000 (batas PostgREST) - 15 Okt 2026, audit paginasi (aturan A.1/A.2).
// `build(dari, sampai)` WAJIB meneruskan ke .range() dan punya .order() deterministik (tambah .order("id")).
// Error DILEMPAR - pemanggil memutuskan (jangan pernah memasang data setengah).
export async function bacaSemuaHalaman(build: (dari: number, sampai: number) => any): Promise<any[]> {
  const semua: any[] = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await build(dari, dari + 999);
    if (error) throw error;
    semua.push(...(data || []));
    if (!data || data.length < 1000) return semua;
  }
}
