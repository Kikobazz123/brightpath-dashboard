"use client"

/**
 * Filter bar for the leads table.
 *
 * State lives in the URL, not in React. A rep who has filtered down to
 * "HIGH priority, breached SLA" can send that link to a colleague or keep it as
 * a bookmark, and the page stays a Server Component that reads `searchParams` —
 * no client-side fetching, no loading spinner over the table.
 */

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState, useTransition } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LEAD_STATUSES,
  PRIORITIES,
  QUALIFICATION_STATUSES,
  SLA_STATES,
} from "@/lib/contracts/leads"
import {
  PRIORITY_LABEL,
  QUALIFICATION_LABEL,
  SLA_LABEL,
  STATUS_LABEL,
} from "@/lib/leads/display"

/** Sentinel for "no filter" — Radix Select cannot hold an empty string value. */
const ANY = "__any__"

export function LeadsFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const current = (key: string) => searchParams.get(key) ?? ANY
  const [query, setQuery] = useState(searchParams.get("q") ?? "")

  // Keep the box in step when the URL changes from elsewhere — a cleared
  // filter, a back button — without fighting the user while they type.
  useEffect(() => {
    setQuery(searchParams.get("q") ?? "")
  }, [searchParams])

  const push = useCallback(
    (next: URLSearchParams) => {
      // Any filter change invalidates the current page number.
      next.delete("page")
      const qs = next.toString()
      startTransition(() => {
        router.push(qs ? `/leads?${qs}` : "/leads")
      })
    },
    [router],
  )

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString())
      if (value === ANY || value === "") next.delete(key)
      else next.set(key, value)
      push(next)
    },
    [push, searchParams],
  )

  const submitQuery = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      setParam("q", query.trim())
    },
    [query, setParam],
  )

  const filterCount = ["status", "priority", "qualification_status", "sla_state", "q"]
    .filter((key) => searchParams.has(key))
    .length

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form onSubmit={submitQuery} className="relative w-full lg:max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search company, contact or need"
          className="pl-8"
          aria-label="Search leads"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Priority"
          value={current("priority")}
          onChange={(value) => setParam("priority", value)}
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
        />
        <FilterSelect
          label="Qualification"
          value={current("qualification_status")}
          onChange={(value) => setParam("qualification_status", value)}
          options={QUALIFICATION_STATUSES.map((s) => ({
            value: s,
            label: QUALIFICATION_LABEL[s],
          }))}
        />
        <FilterSelect
          label="Status"
          value={current("status")}
          onChange={(value) => setParam("status", value)}
          options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        <FilterSelect
          label="SLA"
          value={current("sla_state")}
          onChange={(value) => setParam("sla_state", value)}
          options={SLA_STATES.map((s) => ({ value: s, label: SLA_LABEL[s] }))}
        />

        {filterCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.push("/leads"))}
            disabled={isPending}
          >
            <X className="size-4" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{label}: any</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
