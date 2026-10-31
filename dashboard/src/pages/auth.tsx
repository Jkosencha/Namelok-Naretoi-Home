import { useState, type ReactNode } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Backend } from "@/lib/backend"

// Dark slate page with soft floating circles, like the sign-in reference
function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#3a4558] p-4 sm:p-8">
      <span aria-hidden className="absolute -left-24 -top-24 size-80 rounded-full bg-white/[0.04]" />
      <span aria-hidden className="absolute -bottom-32 left-1/3 size-96 rounded-full bg-white/[0.035]" />
      <span aria-hidden className="absolute right-[8%] top-[12%] size-24 rounded-full bg-white/[0.06]" />
      <span aria-hidden className="absolute bottom-[14%] right-[4%] size-40 rounded-full bg-white/[0.04]" />
      <div className="relative w-full flex justify-center">{children}</div>
    </main>
  )
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
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [show, setShow] = useState(false)
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true)
    try { onSignedIn(await db.signIn(email.trim(), password)) }
    catch (ex) { setErr("Sign-in failed: " + (ex as Error).message); setBusy(false) }
  }
  const field = "h-11 rounded-full border-0 bg-black/25 px-5 text-white placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-white/40"
  return (
    <AuthPage>
      <div className="grid w-full max-w-[1000px] overflow-hidden rounded-[28px] bg-[#46536a] shadow-2xl md:grid-cols-[1.15fr_1fr]">
        {/* Left: white panel with a curved edge, the logo and a photo in a soft blob */}
        <div className="relative hidden min-h-[560px] md:block">
          <svg aria-hidden className="absolute inset-0 size-full" viewBox="0 0 600 600" preserveAspectRatio="none">
            <path d="M0 0H430C520 90 400 190 470 300C540 410 450 500 520 600H0Z" fill="#ffffff" />
          </svg>
          <div className="relative flex h-full flex-col justify-between p-9 pr-24">
            <div className="flex items-center gap-3">
              <img src="../images/logo.png" alt="" className="size-12" />
              <span className="font-semibold leading-tight text-[#2d3646]">Namelok Naretoi Home<br /><span className="text-sm font-normal text-[#6b7587]">Narok, Kenya</span></span>
            </div>
            <div className="relative mx-auto my-6 w-[86%]">
              <span aria-hidden className="absolute -left-6 -top-5 size-16 rounded-full bg-[#46536a]/8" />
              <span aria-hidden className="absolute -bottom-4 right-2 size-10 rounded-full bg-[#46536a]/10" />
              <span aria-hidden className="absolute -right-8 top-8 size-6 rounded-full bg-[#46536a]/12" />
              <svg viewBox="0 0 400 360" className="relative w-full drop-shadow-xl" role="img" aria-label="Children at Namelok Naretoi Home">
                <defs><clipPath id="loginBlob"><path d="M210 12C288 10 368 52 388 132C408 212 362 300 282 336C202 372 104 352 52 290C0 228 4 136 58 78C102 30 148 14 210 12Z" /></clipPath></defs>
                <path d="M216 2C300 0 384 46 396 134C410 230 352 312 270 344C188 376 86 352 38 286C-10 220 0 124 60 64C108 18 154 4 216 2Z" fill="#46536a" opacity="0.08" />
                <image href="../images/namelokBG.jpg" x="0" y="0" width="400" height="360" preserveAspectRatio="xMidYMid slice" clipPath="url(#loginBlob)" />
              </svg>
            </div>
            <p className="text-xs text-[#8a93a3]">© {new Date().getFullYear()} Namelok Naretoi Home · Staff only</p>
          </div>
        </div>

        {/* Right: the form on dark */}
        <div className="relative flex flex-col justify-center px-7 py-10 text-white sm:px-12">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <img src="../images/logo.png" alt="" className="size-11" />
            <span className="font-semibold">Namelok Naretoi Home</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-sm text-white/65">The Namelok team dashboard</p>
          <form onSubmit={submit} className="mt-8 grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="email" className="text-white/85">Email</Label>
              <Input id="email" type="email" required autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></div>
            <div className="grid gap-1.5"><Label htmlFor="password" className="text-white/85">Password</Label>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} required autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className={field + " pr-12"} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/60 hover:text-white">
                  {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
              <p className="text-right text-xs text-white/55">Forgot it? Ask the director to reset it.</p>
            </div>
            {err && <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-2.5 text-sm text-red-100">{err}</p>}
            <Button type="submit" disabled={busy} className="mt-2 h-11 rounded-full bg-[#7fa6b0] text-base font-semibold text-[#1f2937] hover:bg-[#8fb3bd]">{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
        </div>
      </div>
    </AuthPage>
  )
}
