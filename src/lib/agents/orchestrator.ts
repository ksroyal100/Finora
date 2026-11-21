// ============================================================
// FINORA — AI Agent System (7 Executive Agents)
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import { createChatCompletion, createJSONCompletion, MODELS } from '@/lib/ai/groq'
import type { ChatMessage } from '@/lib/ai/groq'
import type {
  AgentName, Agent, AgentTask, AgentWorkflow,
  WorkflowStep, TaskStatus
} from '@/types'

// ── AGENT SYSTEM PROMPTS ──────────────────────────────────────

const AGENT_PROMPTS: Record<AgentName, string> = {
  jarvis: `You are JARVIS, CEO & Chief of Staff of Finora. 
You orchestrate the entire company through AI executives and report to the Founder.

Core functions:
- Synthesize reports from ATHENA (CFO), ORION (CPO), TITAN (CTO), PHOENIX (CGO), MERLIN (CRO), SENTINEL (CSO)
- Make strategic decisions and coordinate multi-agent workflows
- Produce executive summaries and board-level reports
- Delegate tasks to the right agent based on their domain
- Flag urgent issues requiring Founder attention

Always respond with executive clarity. Lead with the headline, support with data, end with action items.
When orchestrating workflows, think systematically about what each agent needs to accomplish.`,

  athena: `You are ATHENA, CFO of Finora.
You own all financial intelligence for the company.

Core functions:
- MRR/ARR analysis and forecasting
- Revenue cohort analysis and churn deep-dives
- Pricing strategy optimization
- Cost structure analysis and burn rate
- Financial modeling and scenario planning
- Investor-ready metrics and reporting
- Marketplace revenue tracking and commission optimization

Always ground analysis in data. Provide specific numbers, trends, and forecasts.
Flag financial risks proactively. Recommend pricing experiments with projected impact.`,

  orion: `You are ORION, Chief Product Officer of Finora.
You own the product vision, roadmap, and user experience.

Core functions:
- Analyze user feedback and feature requests
- Prioritize the product roadmap using impact/effort scoring
- Monitor product metrics (activation, engagement, retention by feature)
- Define product requirements and user stories
- Identify feature gaps vs competitors
- Plan A/B tests and product experiments
- Track NPS and user satisfaction

Always center decisions on user value. Use data to validate hypotheses.
Think in terms of user journeys and jobs-to-be-done.`,

  titan: `You are TITAN, CTO of Finora.
You own all technical architecture, infrastructure, and engineering excellence.

Core functions:
- System architecture review and recommendations
- Infrastructure health monitoring and optimization
- Code quality and technical debt assessment
- Security architecture review
- Performance optimization strategy
- Scalability planning (0→1M users roadmap)
- Technology selection and vendor evaluation
- Incident response and post-mortems

Speak in technical specifics. Quantify performance impacts.
Always consider security, scalability, and maintainability.`,

  phoenix: `You are PHOENIX, Chief Growth Officer of Finora.
You own all growth channels and user acquisition strategy.

Core functions:
- SEO strategy and content marketing plans
- YouTube channel strategy (topics, scripts, thumbnails)
- Email/newsletter campaigns with copy
- Social media strategies (Twitter/X, LinkedIn, Reddit)
- Growth hacking experiments with projections
- Acquisition funnel optimization
- Referral and virality mechanics
- Partnership and collaboration opportunities
- Paid acquisition strategy (when ready)

Think in systems and loops. Every growth initiative should have a measurable hypothesis.
Always tie activities to user acquisition cost and LTV impact.`,

  merlin: `You are MERLIN, Chief Research Officer of Finora.
You deliver deep intelligence on markets, competitors, and opportunities.

Core functions:
- Competitor analysis (features, pricing, positioning, weaknesses)
- Market sizing and TAM/SAM/SOM analysis
- Industry trend identification and implications
- Startup ecosystem analysis
- Investment opportunity research
- Acquisition target identification and due diligence
- Technology trend forecasting
- Customer persona research

Research must be thorough and cited where possible. Lead with key findings.
Distinguish between facts and analysis. Flag information uncertainty.`,

  sentinel: `You are SENTINEL, Chief Security Officer of Finora.
You protect the platform, users, and company from all threats.

Core functions:
- Security event monitoring and threat detection
- Fraud pattern analysis and user risk scoring
- Compliance monitoring (GDPR, CCPA, SOC2 readiness)
- Audit log analysis and anomaly detection
- Vulnerability assessment and remediation
- Incident response planning and execution
- Access control and permission auditing
- Data privacy compliance reporting

Always prioritize user safety. Communicate risks with severity and urgency.
Every security finding should have recommended remediation steps.`,
}

// ── AGENT SERVICE ─────────────────────────────────────────────

export class AgentService {
  private db = createAdminClient()

  // ── GET AGENT ───────────────────────────────────────────────

  async getAgent(name: AgentName): Promise<Agent | null> {
    const { data } = await this.db
      .from('agents')
      .select('*')
      .eq('name', name)
      .single()
    return data
  }

  async getAllAgents(): Promise<Agent[]> {
    const { data } = await this.db
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('name')
    return data ?? []
  }

  // ── UPDATE AGENT STATUS ──────────────────────────────────────

  async setAgentStatus(name: AgentName, status: Agent['status'], taskId?: string) {
    await this.db
      .from('agents')
      .update({
        status,
        current_task_id: taskId ?? null,
        last_active_at: new Date().toISOString(),
      })
      .eq('name', name)
  }

  // ── CHAT WITH AGENT ──────────────────────────────────────────

  async chatWithAgent(params: {
    agentName: AgentName
    conversationId: string
    adminId: string
    userMessage: string
    conversationHistory: ChatMessage[]
    context?: Record<string, unknown>
  }) {
    const { agentName, conversationId, adminId, userMessage, conversationHistory, context } = params

    // Set agent to thinking
    await this.setAgentStatus(agentName, 'thinking')

    try {
      const systemPrompt = this.buildAgentSystemPrompt(agentName, context)

      const messages: ChatMessage[] = [
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ]

      const result = await createChatCompletion(messages, {
        model: MODELS.AGENT_DEFAULT,
        temperature: this.getAgentTemperature(agentName),
        maxTokens: 4096,
        systemPrompt,
      })

      // Save user message
      await this.db.from('agent_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        agent_name: agentName,
      })

      // Save agent response
      await this.db.from('agent_messages').insert({
        conversation_id: conversationId,
        role: 'agent',
        content: result.content,
        agent_name: agentName,
        tokens_used: result.tokensUsed,
        model: result.model,
      })

      // Update conversation stats
      await this.db
        .from('agent_conversations')
        .update({
          message_count: conversationHistory.length + 2,
          total_tokens_used: this.db.rpc('increment', { x: result.tokensUsed }),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      // Update agent usage stats
      await this.db
        .from('agents')
        .update({
          total_tokens_used: this.db.rpc('increment', { x: result.tokensUsed }),
        })
        .eq('name', agentName)

      return { content: result.content, tokensUsed: result.tokensUsed }
    } finally {
      await this.setAgentStatus(agentName, 'idle')
    }
  }

  // ── EXECUTE AGENT TASK ────────────────────────────────────────

  async executeTask(taskId: string): Promise<void> {
    const { data: task } = await this.db
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (!task) throw new Error(`Task ${taskId} not found`)

    await this.db
      .from('agent_tasks')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', taskId)

    await this.setAgentStatus(task.assigned_to, 'working', taskId)

    try {
      const systemPrompt = this.buildAgentSystemPrompt(task.assigned_to, task.context)

      const taskPrompt = this.buildTaskPrompt(task)
      const result = await createChatCompletion(
        [{ role: 'user', content: taskPrompt }],
        {
          model: MODELS.AGENT_DEFAULT,
          temperature: this.getAgentTemperature(task.assigned_to),
          maxTokens: 8192,
          systemPrompt,
        }
      )

      // Parse structured output if expected
      let outputData: Record<string, unknown> = { content: result.content }
      if (task.input_data?.expect_json) {
        try {
          outputData = JSON.parse(result.content)
        } catch {
          outputData = { content: result.content, raw: true }
        }
      }

      await this.db
        .from('agent_tasks')
        .update({
          status: 'completed',
          output_data: outputData,
          completed_at: new Date().toISOString(),
          tokens_used: result.tokensUsed,
          progress_pct: 100,
        })
        .eq('id', taskId)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await this.db
        .from('agent_tasks')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: errorMessage,
        })
        .eq('id', taskId)

      throw error
    } finally {
      await this.setAgentStatus(task.assigned_to, 'idle')
    }
  }

  // ── HELPERS ───────────────────────────────────────────────────

  private buildAgentSystemPrompt(
    agentName: AgentName,
    context?: Record<string, unknown>
  ): string {
    const base = AGENT_PROMPTS[agentName]
    if (!context || Object.keys(context).length === 0) return base

    return `${base}\n\nContext for this session:\n${JSON.stringify(context, null, 2)}`
  }

  private buildTaskPrompt(task: AgentTask): string {
    return `TASK: ${task.title}

${task.description ? `DESCRIPTION:\n${task.description}\n` : ''}
${Object.keys(task.input_data ?? {}).length > 0
  ? `INPUT DATA:\n${JSON.stringify(task.input_data, null, 2)}\n`
  : ''
}
INSTRUCTIONS:
- Complete this task thoroughly
- Provide actionable, specific outputs
- If analysis is required, include data, insights, and recommendations
- Format your response clearly
${task.input_data?.expect_json ? '- Return your response as valid JSON only' : ''}`
  }

  private getAgentTemperature(agentName: AgentName): number {
    const temps: Record<AgentName, number> = {
      jarvis: 0.7,
      athena: 0.3,
      orion: 0.6,
      titan: 0.4,
      phoenix: 0.8,
      merlin: 0.5,
      sentinel: 0.2,
    }
    return temps[agentName]
  }
}

// ── ORCHESTRATOR (JARVIS leads multi-agent workflows) ─────────

export class AgentOrchestrator {
  private agentService = new AgentService()
  private db = createAdminClient()

  async startWorkflow(workflowId: string): Promise<void> {
    const { data: workflow } = await this.db
      .from('agent_workflows')
      .select('*')
      .eq('id', workflowId)
      .single()

    if (!workflow) throw new Error(`Workflow ${workflowId} not found`)

    await this.db
      .from('agent_workflows')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', workflowId)

    // JARVIS plans the workflow
    const plan = await this.jarvisPlanWorkflow(workflow)

    // Execute steps sequentially (or in parallel where deps allow)
    const steps = plan.steps as WorkflowStep[]
    let allOutputs: Record<string, unknown> = { ...workflow.input_data }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]

      // Check dependencies
      const depsComplete = (step.depends_on ?? []).every(depId =>
        steps.find(s => s.id === depId)?.status === 'completed'
      )
      if (!depsComplete) continue

      // Update current step
      await this.db
        .from('agent_workflows')
        .update({ current_step: i + 1 })
        .eq('id', workflowId)

      // Create task for this step
      const { data: task } = await this.db
        .from('agent_tasks')
        .insert({
          assigned_to: step.agent,
          assigned_by: 'jarvis',
          created_by: workflow.created_by,
          workflow_id: workflowId,
          title: step.title,
          description: step.description,
          priority: 'high',
          input_data: { ...allOutputs, ...this.mapInputs(step.input_mapping, allOutputs) },
        })
        .select()
        .single()

      if (!task) throw new Error(`Failed to create task for step ${i}`)

      // Execute task
      await this.agentService.executeTask(task.id)

      // Retrieve result
      const { data: completedTask } = await this.db
        .from('agent_tasks')
        .select('output_data')
        .eq('id', task.id)
        .single()

      if (completedTask?.output_data) {
        allOutputs = {
          ...allOutputs,
          [`step_${i}_output`]: completedTask.output_data,
          ...this.mapOutputs(step.output_mapping, completedTask.output_data as Record<string, unknown>),
        }
      }

      steps[i].status = 'completed'
    }

    // JARVIS produces final executive report
    const finalReport = await this.jarvisProduceFinalReport(workflow, allOutputs)

    await this.db
      .from('agent_workflows')
      .update({
        status: 'completed',
        output_data: allOutputs,
        final_report: finalReport,
        final_report_generated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: Math.floor(
          (Date.now() - new Date(workflow.started_at ?? Date.now()).getTime()) / 1000
        ),
      })
      .eq('id', workflowId)

    // Save as agent report
    await this.db.from('agent_reports').insert({
      agent_name: 'jarvis',
      workflow_id: workflowId,
      title: `Workflow Complete: ${workflow.title}`,
      report_type: 'workflow_summary',
      content: finalReport,
      summary: `Completed workflow with ${steps.length} steps across ${workflow.participating_agents.join(', ')} agents.`,
    })
  }

  private async jarvisPlanWorkflow(workflow: AgentWorkflow) {
    const planningPrompt = `As JARVIS (CEO), plan the execution of this multi-agent workflow.

GOAL: ${workflow.goal}
INPUT DATA: ${JSON.stringify(workflow.input_data, null, 2)}
PARTICIPATING AGENTS: ${workflow.participating_agents.join(', ')}

Break this into specific tasks for each agent. Return JSON:
{
  "steps": [
    {
      "id": "step_1",
      "title": "string",
      "description": "string",
      "agent": "agent_name",
      "action": "string",
      "input_mapping": {},
      "output_mapping": {},
      "depends_on": [],
      "status": "pending"
    }
  ]
}`

    return createJSONCompletion<{ steps: WorkflowStep[] }>(
      [{ role: 'user', content: planningPrompt }],
      {
        model: MODELS.AGENT_DEFAULT,
        temperature: 0.3,
        maxTokens: 4096,
        systemPrompt: AGENT_PROMPTS.jarvis,
      }
    )
  }

  private async jarvisProduceFinalReport(
    workflow: AgentWorkflow,
    allOutputs: Record<string, unknown>
  ): Promise<string> {
    const reportPrompt = `As JARVIS (CEO), synthesize this multi-agent workflow into an executive report for the Founder.

ORIGINAL GOAL: ${workflow.goal}
WORKFLOW: ${workflow.title}
ALL AGENT OUTPUTS: ${JSON.stringify(allOutputs, null, 2)}

Produce a comprehensive executive report with:
1. Executive Summary (2-3 sentences)
2. Key Findings from each agent
3. Strategic Recommendations (top 5, prioritized)
4. Immediate Action Items (next 24-48 hours)
5. 30-Day Roadmap based on findings
6. Risks and Mitigation Strategies`

    const result = await createChatCompletion(
      [{ role: 'user', content: reportPrompt }],
      {
        model: MODELS.AGENT_DEFAULT,
        temperature: 0.5,
        maxTokens: 8192,
        systemPrompt: AGENT_PROMPTS.jarvis,
      }
    )

    return result.content
  }

  private mapInputs(
    mapping: Record<string, string>,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, path] of Object.entries(mapping)) {
      result[key] = this.getNestedValue(data, path)
    }
    return result
  }

  private mapOutputs(
    mapping: Record<string, string>,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(mapping)) {
      result[value] = data[key]
    }
    return result
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)
  }

  // ── QUICK DELEGATIONS ─────────────────────────────────────────

  async delegateToAthena(task: string, context?: Record<string, unknown>) {
    return this.quickDelegate('athena', task, context)
  }

  async delegateToOrion(task: string, context?: Record<string, unknown>) {
    return this.quickDelegate('orion', task, context)
  }

  async delegateToTitan(task: string, context?: Record<string, unknown>) {
    return this.quickDelegate('titan', task, context)
  }

  async delegateToPhoenix(task: string, context?: Record<string, unknown>) {
    return this.quickDelegate('phoenix', task, context)
  }

  async delegateToMerlin(task: string, context?: Record<string, unknown>) {
    return this.quickDelegate('merlin', task, context)
  }

  async delegateToSentinel(task: string, context?: Record<string, unknown>) {
    return this.quickDelegate('sentinel', task, context)
  }

  private async quickDelegate(
    agentName: AgentName,
    task: string,
    context?: Record<string, unknown>
  ) {
    const systemPrompt = AGENT_PROMPTS[agentName]
    const contextStr = context ? `\nContext: ${JSON.stringify(context)}` : ''

    return createChatCompletion(
      [{ role: 'user', content: task + contextStr }],
      {
        model: MODELS.AGENT_DEFAULT,
        temperature: this.agentService['getAgentTemperature'](agentName),
        maxTokens: 4096,
        systemPrompt,
      }
    )
  }
}

// ── SINGLETON EXPORTS ─────────────────────────────────────────

export const agentService = new AgentService()
export const orchestrator = new AgentOrchestrator()
