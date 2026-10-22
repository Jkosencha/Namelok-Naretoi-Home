import { useEffect, useState } from "react"
import { HashRouter, Navigate, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { TitleProvider } from "@/components/page"
import { SiteHeader } from "@/components/site-header"
import { BackendProvider, type Backend } from "@/lib/backend"
import { createDemoBackend, createSupabaseBackend, isConfigured } from "@/lib/data"
import { LoginScreen, MessageScreen, SetupScreen } from "@/pages/auth"
import { CalendarPage } from "@/pages/calendar"
import { ChildPage, ChildrenPage } from "@/pages/children"
import { DonationsPage } from "@/pages/donations"
import { DonorPage, DonorsPage } from "@/pages/donors"
import { ExpensesPage } from "@/pages/expenses"
import { MessagesPage } from "@/pages/messages"
import { Overview } from "@/pages/overview"
import { ReportForm, ReportsList, ReportView } from "@/pages/reports"
import { ResourcePage } from "@/pages/resource-page"
import { SettingsPage } from "@/pages/settings"

type State =
  | { screen: "loading" | "setup" | "login" }
  | { screen: "message"; title: string; text: string }
  | { screen: "noaccess"; user: { email: string } }
  | { screen: "app"; user: { email: string } }

const RESOURCE_ROUTES = ["volunteers", "outreach_visits", "distributions", "stories", "gallery_photos"]

// Sign out automatically after 30 minutes without activity (children's records are sensitive)
function useIdleSignOut(db: Backend | null, active: boolean) {
  useEffect(() => {
    if (!db || !active || db.demo) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => { await db.signOut(); alert("You were signed out after 30 minutes without activity."); location.reload() }, 30 * 60 * 1000)
    }
    const events = ["click", "keydown", "scroll", "touchstart"]
    events.forEach((e) => addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(timer); events.forEach((e) => removeEventListener(e, reset)) }
  }, [db, active])
}

export default function App() {
  const [db, setDb] = useState<Backend | null>(null)
  const [state, setState] = useState<State>({ screen: "loading" })
  useIdleSignOut(db, state.screen === "app")

  useEffect(() => {
    (async () => {
      // ?demo always opens the invented sample data, even when the real database is connected
      if (new URLSearchParams(location.search).has("demo")) {
        const demo = createDemoBackend() as Backend
        setDb(demo)
        return setState({ screen: "app", user: (await demo.currentUser())! })
      }
      if (!isConfigured()) return setState({ screen: "setup" })
      let real: Backend
      try { real = (await createSupabaseBackend()) as Backend } catch (e) {
        return setState({ screen: "message", title: "Could not reach the database", text: `Check your internet connection and refresh. (${(e as Error).message})` })
      }
      setDb(real)
      const user = await real.currentUser()
      if (!user) return setState({ screen: "login" })
      setState((await real.isAdmin()) ? { screen: "app", user } : { screen: "noaccess", user })
    })()
  }, [])

  const signedIn = async (user: { email: string }) => setState((await db!.isAdmin()) ? { screen: "app", user } : { screen: "noaccess", user })

  const screen = (s: State) => {
    switch (s.screen) {
      case "loading": return <div className="min-h-svh bg-background" />
      case "setup": return <SetupScreen />
      case "message": return <MessageScreen title={s.title} text={s.text} />
      case "login": return <LoginScreen db={db!} onSignedIn={signedIn} />
      case "noaccess": return <MessageScreen title="No access" text={`You are signed in as ${s.user.email}, but this account is not on the admin list. Ask the director to add you.`}
        action={<Button variant="outline" onClick={async () => { await db!.signOut(); location.reload() }}>Sign out</Button>} />
      case "app": return <Shell db={db!} user={s.user} />
    }
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="namelok-theme" disableTransitionOnChange>
      <TooltipProvider>
        {screen(state)}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}

function Shell({ db, user }: { db: Backend; user: { email: string } }) {
  return (
    <BackendProvider value={{ db, user, configured: isConfigured() }}>
      <HashRouter>
        <TitleProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="bg-background">
              {db.demo && (
                <div className="mx-4 mt-3 rounded-lg bg-chart-3 md:mx-6 md:mt-4 px-4 py-1.5 text-center text-sm font-medium text-white">
                  Demo mode: invented sample data, nothing is saved.{" "}
                  {isConfigured() ? <a href={location.pathname} className="underline underline-offset-2">Open the real dashboard</a> : "Connect Supabase to use the dashboard for real."}
                </div>
              )}
              <div className="sticky top-0 z-30 bg-background px-4 pt-3 md:px-6 md:pt-4"><SiteHeader /></div>
              <div className="flex-1 p-4 md:p-6">
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/children" element={<ChildrenPage />} />
                  <Route path="/children/:id" element={<ChildPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/donations" element={<DonationsPage />} />
                  <Route path="/donors" element={<DonorsPage />} />
                  <Route path="/donors/:id" element={<DonorPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/reports" element={<ReportsList />} />
                  <Route path="/reports/new" element={<ReportForm />} />
                  <Route path="/reports/:id" element={<ReportView />} />
                  <Route path="/reports/:id/edit" element={<ReportForm />} />
                  {RESOURCE_ROUTES.map((name) => <Route key={name} path={"/" + name} element={<ResourcePage key={name} name={name} />} />)}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </TitleProvider>
      </HashRouter>
    </BackendProvider>
  )
}
