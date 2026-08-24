import { LoginForm1 } from "./components/login-form-1"
import { Logo } from "@/components/logo"
import Link from "next/link"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.next) ? params.next[0] : params.next
  // Only same-origin paths, so the redirect cannot be pointed off-site.
  const next =
    raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard"

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <Logo size={24} />
          </div>
          Brightpath Solutions
        </Link>
        <LoginForm1 next={next} />
      </div>
    </div>
  )
}
