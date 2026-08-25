"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Check } from "lucide-react"
import { cn } from '@/lib/utils'

export interface PricingPlan {
  id: string
  name: string
  description: string
  price: string
  frequency: string
  features: string[]
  popular?: boolean
  current?: boolean
}

interface PricingPlansProps {
  plans?: PricingPlan[]
  mode?: 'pricing' | 'billing'
  currentPlanId?: string
  onPlanSelect?: (planId: string) => void
}

/*
 * The same three engagements the marketing site quotes, in naira.
 *
 * They were an e-commerce SaaS ladder inherited from the template — $19 for
 * "up to 10 products" — which had nothing to do with what Brightpath sells and
 * quietly contradicted /landing#pricing. Keep these in step with
 * `src/app/landing/components/pricing-section.tsx`; two prices for one service
 * is worse than no price at all.
 */
const defaultPlans: PricingPlan[] = [
  {
    id: 'discovery',
    name: 'Discovery',
    description: 'A fixed-price piece of work that ends in a plan you can act on',
    price: '₦450,000',
    frequency: ' one-off',
    features: [
      'Structured review of the current process',
      'Written scope and technical approach',
      'Build estimate with assumptions stated',
      'Recommendation even if that is "do not build"',
      'Credited against the project if you proceed',
    ],
  },
  {
    id: 'project',
    name: 'Project build',
    description: 'Design, build and launch of an agreed scope of work',
    price: '₦2,850,000',
    frequency: ' from',
    features: [
      'Scope fixed before work begins',
      'Weekly working software, not status decks',
      'One named point of contact throughout',
      'Handover documentation you can act on',
      'Source code and infrastructure in your accounts',
      'Post-launch fixes included for an agreed window',
    ],
    popular: true,
  },
  {
    id: 'retainer',
    name: 'Retained support',
    description: 'Ongoing development and maintenance at a predictable rate',
    price: '₦900,000',
    frequency: '/month',
    features: [
      'Agreed block of development time each month',
      'Dependency patching and backup verification',
      'Defined response time for urgent issues',
      'Quarterly review of cost and performance',
      'Roll unused time into the following month',
      'Thirty days notice, no long lock-in',
    ],
  },
]

export function PricingPlans({ 
  plans = defaultPlans, 
  mode = 'pricing', 
  currentPlanId,
  onPlanSelect 
}: PricingPlansProps) {
  const getButtonText = (plan: PricingPlan) => {
    if (mode === 'billing') {
      if (currentPlanId === plan.id) {
        return 'Current Plan'
      }
      const currentIndex = plans.findIndex(p => p.id === currentPlanId)
      const planIndex = plans.findIndex(p => p.id === plan.id)
      
      if (planIndex > currentIndex) {
        return 'Upgrade Plan'
      } else if (planIndex < currentIndex) {
        return 'Downgrade Plan'
      }
    }
    return 'Get Started'
  }

  const getButtonVariant = (plan: PricingPlan) => {
    if (mode === 'billing' && currentPlanId === plan.id) {
      return 'outline' as const
    }
    return plan.popular ? 'default' as const : 'outline' as const
  }

  const isButtonDisabled = (plan: PricingPlan) => {
    return mode === 'billing' && currentPlanId === plan.id
  }

  return (
    <div className='grid gap-8 lg:grid-cols-3'>
      {plans.map(tier => (
        <Card
          key={tier.id}
          className={cn('flex flex-col pt-0', { 
            'border-primary relative shadow-lg': tier.popular,
            'border-primary': currentPlanId === tier.id && mode === 'billing'
          })}
          aria-labelledby={`${tier.id}-title`}
        >
          {tier.popular && (
            <div className='absolute start-0 -top-3 w-full'>
              <Badge className='mx-auto flex w-fit gap-1.5 rounded-full font-medium'>
                <Sparkles className='!size-4' />
                {mode === 'pricing' && (
                <span>Most Popular</span>
                )}
                {currentPlanId === tier.id && mode === 'billing' && (
                  <span>Current Plan</span>
                )}
              </Badge>
            </div>
          )}
          <CardHeader className='space-y-2 pt-8 text-center'>
            <CardTitle id={`${tier.id}-title`} className='text-2xl'>
              {tier.name}
            </CardTitle>
            <p className='text-muted-foreground text-sm text-balance'>{tier.description}</p>
          </CardHeader>
          <CardContent className='flex flex-1 flex-col space-y-6'>
            <div className='flex items-baseline justify-center'>
              <span className='text-4xl font-bold'>{tier.price}</span>
              <span className='text-muted-foreground text-sm'>{tier.frequency}</span>
            </div>
            <div className='space-y-2'>
              {tier.features.map(feature => (
                <div key={feature} className='flex items-center gap-2'>
                  <div className='bg-muted rounded-full p-1'>
                    <Check className='size-3.5' />
                  </div>
                  <span className='text-sm'>{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className='w-full cursor-pointer'
              size='lg'
              variant={getButtonVariant(tier)}
              disabled={isButtonDisabled(tier)}
              onClick={() => onPlanSelect?.(tier.id)}
              aria-label={`${getButtonText(tier)} - ${tier.name} plan`}
            >
              {getButtonText(tier)}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
