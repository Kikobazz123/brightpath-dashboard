"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { signIn } from "@/lib/auth/actions"
import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const loginFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginFormValues = z.infer<typeof loginFormSchema>

export function LoginForm1({
  className,
  next,
  ...props
}: React.ComponentProps<"div"> & { next?: string }) {
  /**
   * Pre-filled on purpose.
   *
   * Nothing is checked — see `src/lib/auth/session.ts` — so asking a first-time
   * visitor to invent credentials would be theatre, and asking them to be told
   * credentials is worse. Arriving filled in makes the one real instruction
   * ("press the button") the obvious one.
   */
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: siteConfig.demoSignIn.email,
      password: siteConfig.demoSignIn.password,
    },
  })

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            The demo account is already filled in — press Sign in to open the
            dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            {/*
              Submits straight to the Server Action. No client-side handler, so
              the form still works with JavaScript disabled.
            */}
            <form action={signIn}>
              <input type="hidden" name="next" value={next ?? "/dashboard"} />
              <div className="grid gap-6">
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={siteConfig.demoSignIn.email}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center">
                          <FormLabel>Password</FormLabel>
                          <a
                            href="/forgot-password"
                            className="ml-auto text-sm underline-offset-4 hover:underline"
                          >
                            Forgot your password?
                          </a>
                        </div>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full cursor-pointer">
                    Sign in
                  </Button>

                </div>
                <div className="text-muted-foreground text-center text-xs">
                  This is a demonstration sign-in. No password is checked and no
                  account is created.
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}
