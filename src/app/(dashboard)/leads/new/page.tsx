import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"

import { CaptureForm } from "./components/capture-form"

export const metadata: Metadata = {
  title: "Capture lead",
  description: "Add a lead from a form, an email, or notes from a call.",
}

export default function NewLeadPage() {
  return (
    <>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-fit -ml-2"
        >
          <Link href="/leads">
            <ArrowLeft className="size-4" />
            Back to leads
          </Link>
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Capture a lead</h1>
          <p className="text-muted-foreground max-w-2xl">
            However it arrived — website form, referral email, notes from a call
            — paste it here. The assistant reads it, cites what it found, and
            has a scored reply waiting before a rep opens the record.
          </p>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <div className="max-w-3xl">
          <CaptureForm />
        </div>
      </div>
    </>
  )
}
