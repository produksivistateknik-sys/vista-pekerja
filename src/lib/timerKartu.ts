// TIMER MILIK KARTU (6 Nov 2026, insiden BAGAS 584 WM.2 pukul 06.01) - satu aturan "sesi timer ini terhitung di kartu tanggal X".
// Kolom tanggal timer = HARI KERJA (ganti pukul 07.00), kartu dibuka menurut tanggal KALENDER: timer yang dijalankan 00.00-06.59
// bertanggal kemarin, sehingga Simpan Progress WIRING & tahap BUSBAR menolak ("timer belum pernah dijalankan") padahal sudah.
// Terhitung bila: masih berjalan, bertanggal sama dgn kartu, atau selesai pada tanggal kalender kartu.
// Pemuatan wajib ikut mengambil tanggal kemarin (kolomTanggalTimerKartu); hasilnya tetap disaring fungsi ini.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { tanggalWibDari } from './tanggalWib'

export const timerMilikKartu = (t: any, tanggalKartu: string): boolean =>
  !t.selesai || t.tanggal === tanggalKartu || tanggalWibDari(t.selesai) === tanggalKartu

const kemarin = (tanggal: string) => new Date(Date.parse(tanggal + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10)
// Saringan .or() PostgREST: timer berjalan + timer bertanggal kartu atau sehari sebelumnya.
export const saringTimerKartu = (tanggalKartu: string) => `selesai.is.null,tanggal.in.(${tanggalKartu},${kemarin(tanggalKartu)})`
