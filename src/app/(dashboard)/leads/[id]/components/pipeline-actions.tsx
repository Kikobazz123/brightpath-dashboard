"use client"

/**
 * The assistant's controls.
 *
 * Each stage is its own button because the four stages produce four different
 * artefacts and a rep needs to be able to redo one without redoing all of them
 * — re-drafting a message after correcting the industry should not re-score
 * the lead. "Run the assistant" chains all four for the common case.
 *
 * Buttons disable while any stage is running: the stages share state on the
 * server, and letting someone press Score while Analyze is mid-flight is a race
 * with a confusing outcome.
 */

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Loader2,
  MessageSquareText,
  Compass,
  Gauge,
  ScanSearch,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  analyzeLead,
  draftFollowUp,
  recommendAction,
  runEntirePipeline,
  scoreLead,
  type ActionResult,
} from "@/lib/client/actions"
import type { Lead } from "@/lib/contracts/leads"

type Stage = "all" | "analyze" | "score" | "follow-up" | "next-action"

export function PipelineActions({ lead }: { lead: Lead }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [running, setRunning] = useState<Stage | null>(null)

  function invoke(stage: Stage, work: () => Promise<ActionResult<Lead>>) {
    setRunning(stage)
    startTransition(async () => {
      const result = await work()

      if (result.ok) toast.success(result.message)
      else toast.error(result.message)

      setRunning(null)
      // The action revalidates the path; this pulls the fresh render in.
      router.refresh()
    })
  }

  const busy = isPending || running !== null

  const stages = [
    {
      id: "analyze" as const,
      label: "Extract evidence",
      icon: ScanSearch,
      run: () => analyzeLead(lead.id),
      done: lead.evidence !== null,
    },
    {
      id: "score" as const,
      label: "Score",
      icon: Gauge,
      run: () => scoreLead(lead.id),
      done: lead.assessment !== null,
    },
    {
      id: "follow-up" as const,
      label: "Draft follow-up",
      icon: MessageSquareText,
      run: () => draftFollowUp(lead.id),
      done: lead.follow_up !== null,
    },
    {
      id: "next-action" as const,
      label: "Recommend action",
      icon: Compass,
      run: () => recommendAction(lead.id),
      done: lead.next_action !== null,
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={() => invoke("all", () => runEntirePipeline(lead.id))}
        disabled={busy}
      >
        {running === "all" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {running === "all" ? "Working…" : "Run the assistant"}
      </Button>

      {stages.map((stage) => (
        <Button
          key={stage.id}
          variant="outline"
          onClick={() => invoke(stage.id, stage.run)}
          disabled={busy}
        >
          {running === stage.id ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <stage.icon className="size-4" />
          )}
          {stage.done ? `Re-run: ${stage.label.toLowerCase()}` : stage.label}
        </Button>
      ))}
    </div>
  )
}
