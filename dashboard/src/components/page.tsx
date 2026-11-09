import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

// The page title shown in the header card
const TitleCtx = createContext<{ title: string; setTitle: (t: string) => void }>({ title: "", setTitle: () => {} })
export function TitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("")
  return <TitleCtx.Provider value={{ title, setTitle }}>{children}</TitleCtx.Provider>
}
export const usePageTitleValue = () => useContext(TitleCtx).title

export function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { setTitle } = useContext(TitleCtx)
  useEffect(() => { setTitle(title); document.title = `${title} · Namelok Dashboard` }, [title, setTitle])
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 [&>*]:min-w-0">
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      {children}
    </div>
  )
}

export const Loading = () => <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
export const ErrorNote = ({ message }: { message: string }) => <div className="rounded-xl bg-destructive/10 p-6 text-center text-sm text-destructive">Something went wrong: {message}</div>
