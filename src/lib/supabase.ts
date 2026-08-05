import { createClient } from '@supabase/supabase-js'

// Fallback ke value literal kalau env var gak ke-set di platform deploy (mis. Vercel project
// yang belum pernah perlu env var ini karena dulu hardcode) - anon key memang didesain publik
// (proteksi sebenarnya ada di RLS, bukan kerahasiaan key ini), jadi aman dipakai sebagai fallback.
// INSIDEN (5 Agu 2026): sempat throw keras kalau env var kosong, yang bikin Vite tree-shake
// SELURUH app jadi bundle nyaris kosong (layar putih total) begitu di-deploy ke platform yang
// env var-nya belum di-set - fallback ini mencegah itu terulang, apa pun kondisi platform-nya.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aoxhxfsqjnquwsxjrsmo.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveGh4ZnNxam5xdXdzeGpyc21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NzQyNzYsImV4cCI6MjA5NTI1MDI3Nn0.xuB1LNY53W-Plof1WjDqF5-ZqiuFol4sOW1Y3y1JpEg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
