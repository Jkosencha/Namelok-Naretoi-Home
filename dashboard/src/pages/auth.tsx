import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Backend } from "@/lib/backend"

function AuthPage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-svh items-center justify-center bg-background p-4">{children}</main>
}
const Logo = () => <img src="../images/logo.png" alt="" className="mx-auto mb-2 size-16" />

export function SetupScreen() {
  return (
    <AuthPage>
      <Card className="w-full max-w-md text-center">
        <CardHeader><Logo /><CardTitle className="text-xl">Dashboard not connected yet</CardTitle>
          <CardDescription>The dashboard needs a Supabase database. Follow the steps in supabase/SETUP.md, then fill in js/supabase-config.js.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">You can look around first in demo mode. It uses invented sample records and saves nothing.</p>
          <Button asChild className="mx-auto"><a href="?demo">Preview the dashboard</a></Button>
        </CardContent>
      </Card>
    </AuthPage>
  )
}

export function MessageScreen({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <AuthPage>
      <Card className="w-full max-w-md text-center">
        <CardHeader><Logo /><CardTitle className="text-xl">{title}</CardTitle><CardDescription>{text}</CardDescription></CardHeader>
        {action && <CardContent>{action}</CardContent>}
      </Card>
    </AuthPage>
  )
}

export function LoginScreen({ db, onSignedIn }: { db: Backend; onSignedIn: (user: { email: string }) => void }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState("")
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true)
    try { onSignedIn(await db.signIn(email.trim(), password)) }
    catch (ex) { setErr("Sign-in failed: " + (ex as Error).message); setBusy(false) }
  }
  return (
    <AuthPage>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center"><Logo /><CardTitle className="text-xl">Namelok Dashboard</CardTitle><CardDescription>Staff sign-in</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
        </CardContent>
      </Card>
    </AuthPage>
  )
}
