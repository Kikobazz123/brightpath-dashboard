"use client"

import { CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'

type FaqItem = {
  value: string
  question: string
  answer: string
}

const faqItems: FaqItem[] = [
  {
    value: 'item-1',
    question: 'How do engagements usually start?',
    answer:
      'With a conversation, then almost always a discovery piece. We look at the process as it actually runs today, write down what building the software would involve, and give you an estimate with the assumptions spelled out. You own that document whether or not you hire us for the build.',
  },
  {
    value: 'item-2',
    question: 'Can you tell me if I even need custom software?',
    answer:
      'Yes, and sometimes the answer is no. A configured off-the-shelf tool beats a bespoke build more often than software companies like to admit. If that is the case for you we will say so during discovery, point you at what to buy, and stop there.',
  },
  {
    value: 'item-3',
    question: 'Who owns the code and the accounts?',
    answer:
      'You do. Source code lives in your repository and infrastructure runs in your accounts, set up that way from the first commit rather than migrated over at the end. Nothing about the handover should depend on our goodwill.',
  },
  {
    value: 'item-4',
    question: 'What happens if the scope changes mid-project?',
    answer:
      'It usually does. Small adjustments we absorb. Anything that materially changes the work gets written up as a change with its own estimate before it starts, so the number never moves without you agreeing to it first.',
  },
  {
    value: 'item-5',
    question: 'What does support actually cover?',
    answer:
      'An agreed block of development time each month, dependency and security patching, backup verification, and a defined response time when something urgent breaks. Unused time rolls into the following month. Notice is thirty days.',
  },
  {
    value: 'item-6',
    question: 'Will you work with the systems we already have?',
    answer:
      'That is most of the job. Very little of what we build stands alone: it reads from the finance system, writes to the CRM, or sits between two tools that were never designed to talk. We work with what you already pay for rather than proposing you replace it.',
  },
]

const FaqSection = () => {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">FAQ</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground">
            How we scope, price and support the work. If your question is not here, ask it directly and you will get a straight answer.
          </p>
        </div>

        {/* FAQ Content */}
        <div className="max-w-4xl mx-auto">
          <div className='bg-transparent'>
            <div className='p-0'>
              <Accordion type='single' collapsible className='space-y-5'>
                {faqItems.map(item => (
                  <AccordionItem key={item.value} value={item.value} className='rounded-md !border bg-transparent'>
                    <AccordionTrigger className='cursor-pointer items-center gap-4 rounded-none bg-transparent py-2 ps-3 pe-4 hover:no-underline data-[state=open]:border-b'>
                      <div className='flex items-center gap-4'>
                        <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full'>
                          <CircleHelp className='size-5' />
                        </div>
                        <span className='text-start font-semibold'>{item.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className='p-4 bg-transparent'>{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>

          {/* Ask us directly CTA */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Still have questions? We&apos;re here to help.
            </p>
            <Button className='cursor-pointer' asChild>
              <a href="#contact">
                Ask us directly
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export { FaqSection }
