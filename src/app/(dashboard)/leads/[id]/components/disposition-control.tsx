"use client"

/**
 * Where the human decides.
 *
 * Kept visually and structurally apart from the assistant's panels because the
 * contract keeps them apart: the pipeline can write evidence, a score, a draft
 * and a recommendation, and none of it can write `status` or `owner`. Those two
 * fields only ever move from this card.
 *
 * The optional note is recorded on the activity row. Three weeks later "lost —
 * went with an in-house build" is the difference between a useful audit trail
 * and a list of state changes.
 */

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, UserRound } from "lucide-react"

import { StatusBadge } from "@/components/leads/badges"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { assignOwner, setLeadStatus } from "@/lib/client/actions"
import { LEAD_STATUSES, type LeadStatus } from "@/lib/contracts/leads"
import { STATUS_LABEL } from "@/lib/leads/display"

export function DispositionControl({
  leadId,
  status,
  owner,
}: {
  leadId: string
  status: LeadStatus
  owner: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [nextStatus, setNextStatus] = useState<LeadStatus>(status)
  const [note, setNote] = useState("")
  const [ownerInput, setOwnerInput] = useState(owner ?? "")

  const statusDirty = nextStatus !== status
  const ownerDirty = (ownerInput.trim() || null) !== owner

  function saveStatus() {
    startTransition(async () => {
      const result = await setLeadStatus(leadId, nextStatus, note.trim() || null)

      if (!result.ok) {
        toast.error(result.message)
        setNextStatus(status)
        return
      }

      toast.success(result.message)
      setNote("")
      router.refresh()
    })
  }

  function saveOwner() {
    startTransition(async () => {
      const result = await assignOwner(leadId, ownerInput)

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(
        ownerInput.trim()
          ? `Assigned to ${ownerInput.trim()}.`
          : "Owner cleared.",
      )
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <span>Sales disposition</span>
          <StatusBadge status={status} />
        </CardTitle>
        <CardDescription>
          Yours, not the assistant&apos;s. Nothing in the pipeline can move a
          lead&apos;s status or reassign it.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={nextStatus}
            onValueChange={(value) => setNextStatus(value as LeadStatus)}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {statusDirty ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Why (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Went with an in-house build. Revisit next budget cycle."
            />
            <p className="text-muted-foreground text-xs">
              Recorded on the timeline against this change.
            </p>
          </div>
        ) : null}

        {statusDirty ? (
          <div className="flex items-center gap-2">
            <Button onClick={saveStatus} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Move to {STATUS_LABEL[nextStatus]}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setNextStatus(status)
                setNote("")
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-t pt-5">
          <Label htmlFor="owner">Owner</Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <UserRound className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                id="owner"
                value={ownerInput}
                onChange={(event) => setOwnerInput(event.target.value)}
                placeholder="Unassigned"
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              onClick={saveOwner}
              disabled={isPending || !ownerDirty}
            >
              Save
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            An unassigned high-priority lead is the one that goes cold. This is
            the field that stops that being invisible.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
