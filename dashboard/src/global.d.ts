// Settings from ../js/supabase-config.js (shared with the public website)
interface Window {
  NAMELOK_SUPABASE?: { url: string; anonKey: string }
}
declare module "@/lib/data" {
  export function isConfigured(): boolean
  export function createSupabaseBackend(): Promise<any>
  export function createDemoBackend(): any
}
