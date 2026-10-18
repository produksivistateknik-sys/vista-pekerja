// (18 Okt 2026, antrean foto) panggil `fn` setiap kali antrean foto HP selesai menempel / membuang foto
// (lib/antreanFoto EVENT_HASIL_ANTREAN_FOTO) - layar dokumentasi memuat ulang datanya supaya foto langsung tampil.
import { useEffect, useRef } from 'react'
import { EVENT_HASIL_ANTREAN_FOTO } from './antreanFoto'

export function useSaatFotoAntreanTertempel(fn: () => void): void {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const h = () => ref.current()
    window.addEventListener(EVENT_HASIL_ANTREAN_FOTO, h)
    return () => window.removeEventListener(EVENT_HASIL_ANTREAN_FOTO, h)
  }, [])
}
