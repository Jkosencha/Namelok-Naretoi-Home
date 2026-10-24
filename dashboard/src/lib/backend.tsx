import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { Row } from "./format"

// The data layer (Supabase or the in-memory demo), shared with every page
export type Backend = {
  demo: boolean
  currentUser(): Promise<{ email: string } | null>
  signIn(email: string, password: string): Promise<{ email: string }>
  signOut(): Promise<void>
  isAdmin(): Promise<boolean>
  list(table: string, opts?: { order?: string; ascending?: boolean; eq?: Row }): Promise<Row[]>
  insert(table: string, row: Row): Promise<Row>
  update(table: string, id: string, row: Row): Promise<Row>
  remove(table: string, id: string): Promise<void>
  saveSetting(key: string, value: string): Promise<void>
  uploadPublic(file: File): Promise<string>
  uploadPrivate(file: File, folder?: string): Promise<string>
  privateUrl(path: string): Promise<string>
  privateUrls(paths: string[]): Promise<Record<string, string>>
  removePrivate(path: string): Promise<void>
  uploadDocument(file: File, folder?: string): Promise<string>
  documentUrl(path: string, downloadName?: string): Promise<string>
}

type Session = { db: Backend; user: { email: string }; configured: boolean }
const Ctx = createContext<Session | null>(null)
export const BackendProvider = ({ value, children }: { value: Session; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>
export function useSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error("No session")
  return s
}
export const useDb = () => useSession().db

// Load one or more tables; `reload` fetches them again after a change
export function useTables(tables: string[], opts: Record<string, { order?: string; ascending?: boolean; eq?: Row }> = {}) {
  const db = useDb()
  const [data, setData] = useState<Record<string, Row[]> | null>(null)
  const [error, setError] = useState<string>("")
  const key = tables.join(",") + JSON.stringify(opts)
  const reload = useCallback(async () => {
    try {
      const rows = await Promise.all(tables.map((t) => db.list(t, opts[t])))
      setData(Object.fromEntries(tables.map((t, i) => [t, rows[i]])))
    } catch (e) {
      setError((e as Error).message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key])
  useEffect(() => { reload() }, [reload])
  return { data, error, reload }
}
