'use client'

import { AIRedirectCard } from './AIRedirectCard'

export function AIFinancialPlannerRedirect() {
  return (
    <AIRedirectCard
      title="AI Financial Planner"
      description="Describe your goal in plain English and get a real, conversational financial plan — not a fixed formula. This lives in AI Coach, where it can ask follow-up questions and adjust as your situation changes."
      examplePrompts={[
        'I want to retire by 55 with $80k/year in today\'s dollars — what do I need to save?',
        'Help me build a 12-month plan to pay off my debt and start investing.',
        'I just got a raise — how should I split it between saving, investing, and spending?',
      ]}
    />
  )
}

export function WhatIfSimulatorRedirect() {
  return (
    <AIRedirectCard
      title="What-If Simulator"
      description="Ask a what-if question and get a real answer that reasons across your specific numbers — better suited to a conversation than a fixed calculator."
      examplePrompts={[
        'What if I invested an extra $500/month starting today instead of next year?',
        'What if I switched from a 30-year to a 15-year mortgage?',
        'What if I took a lower-paying job with better equity — how does that compare long-term?',
      ]}
    />
  )
}
