import { useState } from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Choice = { value: string; label: string; sub?: string }

// A searchable dropdown: type a few letters to find a donor or child.
// `extra` choices (e.g. "General funds") are listed first; `onCreate` offers "Add new …" for the typed text.
export function SearchSelect({ id, value, onChange, choices, extra = [], placeholder, onCreate, createLabel = "Add" }: {
  id?: string; value: string; onChange: (v: string) => void; choices: Choice[]; extra?: Choice[]
  placeholder: string; onCreate?: (text: string) => void; createLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const all = [...extra, ...choices]
  const current = all.find((c) => c.value === value)
  const exact = choices.some((c) => c.label.toLowerCase() === text.trim().toLowerCase())
  const pick = (v: string) => { onChange(v); setOpen(false); setText("") }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn("truncate", !current && "text-muted-foreground")}>{current ? current.label : placeholder}</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" value={text} onValueChange={setText} />
          <CommandList>
            <CommandEmpty>{onCreate && text.trim() ? "No match yet." : "Nothing found."}</CommandEmpty>
            {extra.length > 0 && (
              <>
                <CommandGroup>{extra.map((c) => <Item key={c.value || "none"} c={c} selected={c.value === value} onPick={pick} />)}</CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup>{choices.map((c) => <Item key={c.value} c={c} selected={c.value === value} onPick={pick} />)}</CommandGroup>
            {onCreate && text.trim() && !exact && (
              <CommandGroup forceMount>
                <CommandItem forceMount value={"__create " + text} onSelect={() => { onCreate(text.trim()); setOpen(false); setText("") }}>
                  <PlusIcon /> {createLabel} “{text.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function Item({ c, selected, onPick }: { c: Choice; selected: boolean; onPick: (v: string) => void }) {
  return (
    <CommandItem value={c.label + " " + (c.sub || "") + " " + c.value} onSelect={() => onPick(c.value)}>
      <CheckIcon className={cn(selected ? "opacity-100" : "opacity-0")} />
      <span className="min-w-0 flex-1 truncate">{c.label}{c.sub && <span className="ml-1.5 text-xs text-muted-foreground">{c.sub}</span>}</span>
    </CommandItem>
  )
}
