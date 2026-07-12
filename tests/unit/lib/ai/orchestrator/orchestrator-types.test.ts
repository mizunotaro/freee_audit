import { describe, it, expect } from 'vitest'
import type {
  IntentType,
  IntentClassification,
  WorkflowStep,
  WorkflowDefinition,
  OrchestratorContext,
  ConversationTurn,
  OrchestratorRequest,
  PersonaAnalysis,
  SynthesizedResponse,
  DivergentView,
  OrchestratorResult,
  OrchestratorEvent,
} from '@/lib/ai/orchestrator/orchestrator-types'
import type { PersonaResponse, PersonaType } from '@/lib/ai/personas/types'
import type { SelectionResult } from '@/lib/ai/orchestrator/types'

// The full closed set of intent literals, typed so removal/rename fails at both
// compile time (assignment to IntentType[]) and runtime (length + Set checks).
const INTENT_TYPES: readonly IntentType[] = [
  'financial_analysis',
  'tax_inquiry',
  'strategic_planning',
  'compliance_check',
  'ratio_analysis',
  'cashflow_analysis',
  'budget_inquiry',
  'forecast_request',
  'general_inquiry',
]

const PERSONAS: readonly PersonaType[] = [
  'cpa',
  'tax_accountant',
  'cfo',
  'financial_analyst',
  'big4_auditor',
]

const ORCHESTRATOR_ERROR_CODES = ['no_personas', 'all_failed', 'timeout', 'invalid_input'] as const

const EVENT_TYPES = [
  'intent_classified',
  'workflow_selected',
  'model_selected',
  'persona_started',
  'persona_completed',
  'persona_failed',
  'synthesis_completed',
  'orchestration_completed',
] as const

// --- deep nested-type factories (their shape is owned by sibling modules; here
// we only need values that satisfy the types so the orchestrator-types surfaces
// can be constructed and asserted) ---
function buildPersonaResponse(persona: PersonaType): PersonaResponse {
  return {
    persona,
    conclusion: `${persona} conclusion`,
    confidence: 0.82,
    reasoning: [{ point: 'p', analysis: 'a', evidence: 'e', confidence: 0.7 }],
    risks: [],
    metadata: {
      modelUsed: 'test-model',
      tokensUsed: 120,
      processingTimeMs: 42,
      templateVersion: '1.0.0',
    },
  }
}

function buildSelectionResult(): SelectionResult {
  return {
    model: {
      provider: 'openai',
      modelId: 'gpt-test',
      displayName: 'Test Model',
      capabilities: {
        vision: false,
        tools: true,
        json: true,
        streaming: true,
        maxContextLength: 8000,
        maxOutputTokens: 1000,
      },
      pricing: { inputPerMillion: 1, outputPerMillion: 2 },
      avgLatencyMs: 200,
      reliability: 0.99,
    },
    reason: 'best fit',
    estimatedCost: 0.001,
    estimatedLatencyMs: 200,
    fallbackChain: [],
    selectionScore: 0.95,
  }
}

function buildIntentClassification(): IntentClassification {
  return {
    primary: 'financial_analysis',
    confidence: 0.9,
    secondary: ['ratio_analysis'],
    keywords: ['分析', '比率'],
  }
}

function buildPersonaAnalysis(persona: PersonaType): PersonaAnalysis {
  return {
    persona,
    response: buildPersonaResponse(persona),
    executionTimeMs: 350,
    modelUsed: 'test-model',
    tokensUsed: 120,
  }
}

function buildSynthesizedResponse(): SynthesizedResponse {
  return {
    summary: 'summary',
    personaAnalyses: PERSONAS.map(buildPersonaAnalysis),
    consensusPoints: ['consensus'],
    divergentViews: [{ topic: 't', perspectives: [{ persona: 'cpa', viewpoint: 'v' }] }],
    recommendedAction: 'act',
    confidence: 0.88,
    processingTimeMs: 1000,
    totalCost: 0.02,
  }
}

function buildWorkflowStep(id: string): WorkflowStep {
  return {
    id,
    persona: 'cpa',
    task: 'do analysis',
    dependencies: [],
    parallel: true,
    optional: false,
  }
}

function buildWorkflowDefinition(): WorkflowDefinition {
  return {
    id: 'comprehensive_analysis',
    name: 'Comprehensive Analysis',
    description: 'All personas in parallel',
    steps: [buildWorkflowStep('s1'), buildWorkflowStep('s2')],
    version: '1.0.0',
  }
}

describe('src/lib/ai/orchestrator/orchestrator-types', () => {
  describe('module surface', () => {
    it('resolves at runtime (type-only module -> empty after type-stripping)', async () => {
      const mod = await import('@/lib/ai/orchestrator/orchestrator-types')
      expect(mod).toBeDefined()
      expect(typeof mod).toBe('object')
    })
  })

  describe('IntentType union', () => {
    it('exposes exactly the 9 documented intents', () => {
      expect(INTENT_TYPES).toHaveLength(9)
      expect(new Set(INTENT_TYPES).size).toBe(9)
    })

    it('a representative literal satisfies the type at runtime', () => {
      const primary: IntentType = 'tax_inquiry'
      expect(primary).toBe('tax_inquiry')
    })

    it('the union equals exactly the string-literal set (type-param form)', () => {
      expectTypeOf<IntentType>().toEqualTypeOf<
        | 'financial_analysis'
        | 'tax_inquiry'
        | 'strategic_planning'
        | 'compliance_check'
        | 'ratio_analysis'
        | 'cashflow_analysis'
        | 'budget_inquiry'
        | 'forecast_request'
        | 'general_inquiry'
      >()
    })

    it('is a closed union: an arbitrary string is not an IntentType', () => {
      expectTypeOf<string>().not.toMatchTypeOf<IntentType>()
    })
  })

  describe('IntentClassification', () => {
    it('constructs a fully-populated object', () => {
      const ic: IntentClassification = {
        primary: 'strategic_planning',
        confidence: 0.75,
        secondary: ['financial_analysis', 'ratio_analysis'],
        keywords: ['成長', '戦略', 'ROI'],
      }
      expect(ic.primary).toBe('strategic_planning')
      expect(ic.confidence).toBe(0.75)
      expect(ic.secondary).toHaveLength(2)
      expect(ic.keywords).toHaveLength(3)
    })

    it('accepts empty collections (boundary)', () => {
      const ic: IntentClassification = {
        primary: 'general_inquiry',
        confidence: 0.1,
        secondary: [],
        keywords: [],
      }
      expect(ic.secondary).toHaveLength(0)
      expect(ic.keywords).toHaveLength(0)
    })

    it('accepts confidence at the 0 and 1 boundaries', () => {
      const min: IntentClassification = {
        primary: 'general_inquiry',
        confidence: 0,
        secondary: [],
        keywords: [],
      }
      const max: IntentClassification = {
        primary: 'general_inquiry',
        confidence: 1,
        secondary: [],
        keywords: [],
      }
      expect(min.confidence).toBe(0)
      expect(max.confidence).toBe(1)
    })

    it('confidence is typed as number', () => {
      expectTypeOf<IntentClassification['confidence']>().toEqualTypeOf<number>()
    })

    it('all fields are readonly (compile-time guard)', () => {
      const ic: IntentClassification = {
        primary: 'general_inquiry',
        confidence: 0.5,
        secondary: [],
        keywords: [],
      }
      const tryMutate = (): void => {
        // @ts-expect-error "primary is readonly: assignment errors with TS2540"
        ic.primary = 'tax_inquiry'
        // @ts-expect-error "confidence is readonly: assignment errors with TS2540"
        ic.confidence = 0
      }
      void tryMutate
      expect(ic.primary).toBe('general_inquiry')
    })
  })

  describe('WorkflowStep', () => {
    it('constructs a fully-populated step', () => {
      const step: WorkflowStep = {
        id: 'cpa-step',
        persona: 'cpa',
        task: 'Audit journals',
        dependencies: ['setup-step'],
        parallel: true,
        optional: false,
      }
      expect(step.id).toBe('cpa-step')
      expect(step.persona).toBe('cpa')
      expect(step.dependencies).toEqual(['setup-step'])
      expect(step.parallel).toBe(true)
      expect(step.optional).toBe(false)
    })

    it('accepts a dependency-free step (boundary)', () => {
      const step: WorkflowStep = {
        id: 'solo',
        persona: 'cfo',
        task: 'Overview',
        dependencies: [],
        parallel: false,
        optional: true,
      }
      expect(step.dependencies).toHaveLength(0)
      expect(step.optional).toBe(true)
    })

    it('dependencies is readonly string[]', () => {
      expectTypeOf<WorkflowStep['dependencies']>().toEqualTypeOf<readonly string[]>()
    })

    it('persona is the PersonaType union', () => {
      expectTypeOf<WorkflowStep['persona']>().toMatchTypeOf<PersonaType>()
    })

    it('all fields are readonly (compile-time guard)', () => {
      const step: WorkflowStep = {
        id: 's',
        persona: 'cpa',
        task: 't',
        dependencies: [],
        parallel: false,
        optional: false,
      }
      const tryMutate = (): void => {
        // @ts-expect-error "id is readonly: assignment errors with TS2540"
        step.id = 'x'
        // @ts-expect-error "task is readonly: assignment errors with TS2540"
        step.task = 'y'
      }
      void tryMutate
      expect(step.id).toBe('s')
    })
  })

  describe('WorkflowDefinition', () => {
    it('constructs a fully-populated definition', () => {
      const wf: WorkflowDefinition = buildWorkflowDefinition()
      expect(wf.id).toBe('comprehensive_analysis')
      expect(wf.name).toBe('Comprehensive Analysis')
      expect(wf.description).toBe('All personas in parallel')
      expect(wf.steps).toHaveLength(2)
      expect(wf.version).toBe('1.0.0')
    })

    it('accepts an empty steps list (boundary)', () => {
      const wf: WorkflowDefinition = {
        id: 'empty',
        name: 'Empty',
        description: 'no steps',
        steps: [],
        version: '0.0.0',
      }
      expect(wf.steps).toHaveLength(0)
    })

    it('steps is a readonly WorkflowStep array', () => {
      expectTypeOf<WorkflowDefinition['steps']>().toEqualTypeOf<readonly WorkflowStep[]>()
    })

    it('all fields are readonly (compile-time guard)', () => {
      const wf: WorkflowDefinition = buildWorkflowDefinition()
      const tryMutate = (): void => {
        // @ts-expect-error "id is readonly: assignment errors with TS2540"
        wf.id = 'x'
        // @ts-expect-error "version is readonly: assignment errors with TS2540"
        wf.version = '9'
      }
      void tryMutate
      expect(wf.version).toBe('1.0.0')
    })
  })

  describe('OrchestratorContext', () => {
    it('constructs with only the required fields (companyId/financialData optional)', () => {
      const ctx: OrchestratorContext = {
        sessionId: 's1',
        userId: 'u1',
        language: 'ja',
        conversationHistory: [],
      }
      expect(ctx.sessionId).toBe('s1')
      expect(ctx.userId).toBe('u1')
      expect(ctx.companyId).toBeUndefined()
      expect(ctx.financialData).toBeUndefined()
      expect(ctx.conversationHistory).toHaveLength(0)
    })

    it('constructs with every optional field populated', () => {
      const ctx: OrchestratorContext = {
        sessionId: 's1',
        userId: 'u1',
        companyId: 'c1',
        language: 'en',
        conversationHistory: [{ role: 'user', content: 'hi', timestamp: new Date(0) }],
        financialData: { revenue: 1000 },
      }
      expect(ctx.companyId).toBe('c1')
      expect(ctx.language).toBe('en')
      expect(ctx.financialData?.revenue).toBe(1000)
    })

    it('language is exactly the ja|en union', () => {
      expectTypeOf<OrchestratorContext['language']>().toEqualTypeOf<'ja' | 'en'>()
    })

    it('optional companyId is string | undefined', () => {
      expectTypeOf<OrchestratorContext['companyId']>().toEqualTypeOf<string | undefined>()
    })

    it('financialData is an arbitrary-keyed record', () => {
      expectTypeOf<OrchestratorContext['financialData']>().toEqualTypeOf<
        Record<string, unknown> | undefined
      >()
    })

    it('required fields are readonly (compile-time guard)', () => {
      const ctx: OrchestratorContext = {
        sessionId: 's',
        userId: 'u',
        language: 'ja',
        conversationHistory: [],
      }
      const tryMutate = (): void => {
        // @ts-expect-error "sessionId is readonly: assignment errors with TS2540"
        ctx.sessionId = 'x'
      }
      void tryMutate
      expect(ctx.sessionId).toBe('s')
    })
  })

  describe('ConversationTurn', () => {
    it('constructs a user turn without personaUsed', () => {
      const turn: ConversationTurn = {
        role: 'user',
        content: '質問',
        timestamp: new Date(0),
      }
      expect(turn.role).toBe('user')
      expect(turn.content).toBe('質問')
      expect(turn.timestamp).toBeInstanceOf(Date)
      expect(turn.personaUsed).toBeUndefined()
    })

    it('constructs an assistant turn with personaUsed', () => {
      const turn: ConversationTurn = {
        role: 'assistant',
        content: '回答',
        timestamp: new Date(1),
        personaUsed: 'cfo',
      }
      expect(turn.role).toBe('assistant')
      expect(turn.personaUsed).toBe('cfo')
    })

    it('role is exactly the user|assistant union', () => {
      expectTypeOf<ConversationTurn['role']>().toEqualTypeOf<'user' | 'assistant'>()
    })

    it('optional personaUsed is PersonaType | undefined', () => {
      expectTypeOf<ConversationTurn['personaUsed']>().toEqualTypeOf<PersonaType | undefined>()
    })

    it('fields are readonly (compile-time guard)', () => {
      const turn: ConversationTurn = { role: 'user', content: 'c', timestamp: new Date(0) }
      const tryMutate = (): void => {
        // @ts-expect-error "role is readonly: assignment errors with TS2540"
        turn.role = 'assistant'
      }
      void tryMutate
      expect(turn.role).toBe('user')
    })
  })

  describe('OrchestratorRequest', () => {
    it('constructs with only query + context (constraints optional)', () => {
      const req: OrchestratorRequest = {
        query: '分析して',
        context: {
          sessionId: 's',
          userId: 'u',
          language: 'ja',
          conversationHistory: [],
        },
      }
      expect(req.query).toBe('分析して')
      expect(req.constraints).toBeUndefined()
    })

    it('accepts an empty-string query (boundary)', () => {
      const req: OrchestratorRequest = {
        query: '',
        context: { sessionId: 's', userId: 'u', language: 'ja', conversationHistory: [] },
      }
      expect(req.query).toBe('')
    })

    it('constructs with every constraint field populated', () => {
      const req: OrchestratorRequest = {
        query: 'q',
        context: { sessionId: 's', userId: 'u', language: 'en', conversationHistory: [] },
        constraints: {
          maxCost: 0.5,
          maxLatencyMs: 5000,
          preferredPersonas: ['cpa', 'tax_accountant'],
          enableReproducibility: true,
          seed: 42,
          temperature: 0.3,
        },
      }
      expect(req.constraints?.maxCost).toBe(0.5)
      expect(req.constraints?.maxLatencyMs).toBe(5000)
      expect(req.constraints?.preferredPersonas).toHaveLength(2)
      expect(req.constraints?.seed).toBe(42)
      expect(req.constraints?.temperature).toBe(0.3)
      expect(req.constraints?.enableReproducibility).toBe(true)
    })

    it('accepts a constraints object with zero-valued bounds (boundary)', () => {
      const req: OrchestratorRequest = {
        query: 'q',
        context: { sessionId: 's', userId: 'u', language: 'ja', conversationHistory: [] },
        constraints: { maxCost: 0, maxLatencyMs: 0, seed: 0, temperature: 0 },
      }
      expect(req.constraints?.maxCost).toBe(0)
      expect(req.constraints?.maxLatencyMs).toBe(0)
      expect(req.constraints?.seed).toBe(0)
      expect(req.constraints?.temperature).toBe(0)
    })

    it('every constraint field is individually optional', () => {
      const req: OrchestratorRequest = {
        query: 'q',
        context: { sessionId: 's', userId: 'u', language: 'ja', conversationHistory: [] },
        constraints: {},
      }
      expect(req.constraints?.maxCost).toBeUndefined()
      expect(req.constraints?.preferredPersonas).toBeUndefined()
      expect(req.constraints?.enableReproducibility).toBeUndefined()
    })
  })

  describe('PersonaAnalysis', () => {
    it('constructs a fully-populated analysis', () => {
      const pa: PersonaAnalysis = buildPersonaAnalysis('big4_auditor')
      expect(pa.persona).toBe('big4_auditor')
      expect(pa.response.persona).toBe('big4_auditor')
      expect(pa.executionTimeMs).toBe(350)
      expect(pa.modelUsed).toBe('test-model')
      expect(pa.tokensUsed).toBe(120)
    })

    it('response carries the full PersonaResponse shape', () => {
      const pa: PersonaAnalysis = buildPersonaAnalysis('cfo')
      expect(pa.response.confidence).toBe(0.82)
      expect(pa.response.metadata.templateVersion).toBe('1.0.0')
    })

    it('executionTimeMs accepts a zero boundary (instant)', () => {
      const pa: PersonaAnalysis = {
        persona: 'cpa',
        response: buildPersonaResponse('cpa'),
        executionTimeMs: 0,
        modelUsed: 'm',
        tokensUsed: 0,
      }
      expect(pa.executionTimeMs).toBe(0)
      expect(pa.tokensUsed).toBe(0)
    })

    it('all fields are readonly (compile-time guard)', () => {
      const pa: PersonaAnalysis = buildPersonaAnalysis('cpa')
      const tryMutate = (): void => {
        // @ts-expect-error "modelUsed is readonly: assignment errors with TS2540"
        pa.modelUsed = 'x'
      }
      void tryMutate
      expect(pa.modelUsed).toBe('test-model')
    })
  })

  describe('SynthesizedResponse', () => {
    it('constructs a fully-populated response', () => {
      const sr: SynthesizedResponse = buildSynthesizedResponse()
      expect(sr.summary).toBe('summary')
      expect(sr.personaAnalyses).toHaveLength(PERSONAS.length)
      expect(sr.consensusPoints).toHaveLength(1)
      expect(sr.divergentViews).toHaveLength(1)
      expect(sr.recommendedAction).toBe('act')
      expect(sr.confidence).toBe(0.88)
      expect(sr.processingTimeMs).toBe(1000)
      expect(sr.totalCost).toBe(0.02)
    })

    it('accepts all-empty collections (boundary)', () => {
      const sr: SynthesizedResponse = {
        summary: '',
        personaAnalyses: [],
        consensusPoints: [],
        divergentViews: [],
        recommendedAction: '',
        confidence: 0,
        processingTimeMs: 0,
        totalCost: 0,
      }
      expect(sr.summary).toBe('')
      expect(sr.personaAnalyses).toHaveLength(0)
      expect(sr.confidence).toBe(0)
      expect(sr.totalCost).toBe(0)
    })

    it('personaAnalyses is a readonly PersonaAnalysis array', () => {
      expectTypeOf<SynthesizedResponse['personaAnalyses']>().toEqualTypeOf<
        readonly PersonaAnalysis[]
      >()
    })

    it('confidence and totalCost are numbers (no range clamp at the type level)', () => {
      expectTypeOf<SynthesizedResponse['confidence']>().toEqualTypeOf<number>()
      expectTypeOf<SynthesizedResponse['totalCost']>().toEqualTypeOf<number>()
    })

    it('fields are readonly (compile-time guard)', () => {
      const sr: SynthesizedResponse = buildSynthesizedResponse()
      const tryMutate = (): void => {
        // @ts-expect-error "summary is readonly: assignment errors with TS2540"
        sr.summary = 'x'
      }
      void tryMutate
      expect(sr.summary).toBe('summary')
    })
  })

  describe('DivergentView', () => {
    it('constructs a view with multiple perspectives', () => {
      const dv: DivergentView = {
        topic: '配当政策',
        perspectives: [
          { persona: 'cfo', viewpoint: '成長へ再投資' },
          { persona: 'financial_analyst', viewpoint: '株主還元優先' },
        ],
      }
      expect(dv.topic).toBe('配当政策')
      expect(dv.perspectives).toHaveLength(2)
      expect(dv.perspectives[0].persona).toBe('cfo')
    })

    it('accepts an empty perspectives list (boundary)', () => {
      const dv: DivergentView = { topic: 'none', perspectives: [] }
      expect(dv.perspectives).toHaveLength(0)
    })

    it('perspective.persona is the PersonaType union', () => {
      type Perspective = DivergentView['perspectives'][number]
      expectTypeOf<Perspective['persona']>().toMatchTypeOf<PersonaType>()
    })

    it('fields are readonly (compile-time guard)', () => {
      const dv: DivergentView = { topic: 't', perspectives: [] }
      const tryMutate = (): void => {
        // @ts-expect-error "topic is readonly: assignment errors with TS2540"
        dv.topic = 'x'
      }
      void tryMutate
      expect(dv.topic).toBe('t')
    })
  })

  describe('OrchestratorResult', () => {
    function buildMetadata() {
      return {
        workflowId: 'comprehensive_analysis',
        intentClassification: buildIntentClassification(),
        modelSelection: buildSelectionResult(),
        timestamp: new Date(0),
      }
    }

    it('constructs a success result', () => {
      const r: OrchestratorResult = {
        success: true,
        response: buildSynthesizedResponse(),
        metadata: buildMetadata(),
      }
      expect(r.success).toBe(true)
      expect(r.response?.summary).toBe('summary')
      expect(r.error).toBeUndefined()
      expect(r.metadata.workflowId).toBe('comprehensive_analysis')
    })

    it('constructs an error result for every error code (fail-safe codes)', () => {
      for (const code of ORCHESTRATOR_ERROR_CODES) {
        const r: OrchestratorResult = {
          success: false,
          error: { code, message: `failed:${code}` },
          metadata: buildMetadata(),
        }
        expect(r.success).toBe(false)
        expect(r.error?.code).toBe(code)
        expect(r.response).toBeUndefined()
      }
    })

    it('error result tolerates missing partialResults (optional fail-safe field)', () => {
      const r: OrchestratorResult = {
        success: false,
        error: { code: 'all_failed', message: 'all personas failed' },
        metadata: buildMetadata(),
      }
      expect(r.error?.partialResults).toBeUndefined()
    })

    it('error result can carry partialResults', () => {
      const r: OrchestratorResult = {
        success: false,
        error: {
          code: 'timeout',
          message: 'timed out',
          partialResults: [buildPersonaAnalysis('cpa')],
        },
        metadata: buildMetadata(),
      }
      expect(r.error?.partialResults).toHaveLength(1)
      expect(r.error?.partialResults?.[0].persona).toBe('cpa')
    })

    it('metadata is always present, regardless of success/error', () => {
      const ok: OrchestratorResult = {
        success: true,
        response: buildSynthesizedResponse(),
        metadata: buildMetadata(),
      }
      const fail: OrchestratorResult = {
        success: false,
        error: { code: 'no_personas', message: 'm' },
        metadata: buildMetadata(),
      }
      expect(ok.metadata.intentClassification.primary).toBe('financial_analysis')
      expect(fail.metadata.modelSelection.selectionScore).toBe(0.95)
      expectTypeOf<OrchestratorResult['metadata']>().toMatchTypeOf<{
        readonly workflowId: string
        readonly intentClassification: IntentClassification
        readonly modelSelection: SelectionResult
        readonly timestamp: Date
      }>()
    })

    it('error.code is a closed set (4 documented codes)', () => {
      expect(ORCHESTRATOR_ERROR_CODES).toHaveLength(4)
      expect(new Set(ORCHESTRATOR_ERROR_CODES).size).toBe(4)
      expectTypeOf<OrchestratorResult['error']>().toMatchTypeOf<
        | undefined
        | {
            code: 'no_personas' | 'all_failed' | 'timeout' | 'invalid_input'
            message: string
            partialResults?: readonly PersonaAnalysis[]
          }
      >()
    })

    it('response and error are independently optional (success is boolean, not a discriminator)', () => {
      // OrchestratorResult is a flat interface (success: boolean), so the flag
      // does NOT narrow response/error — each stays `T | undefined`. Assert the
      // honest optional shape via indexed access (toMatchTypeOf is robust for
      // unions; toEqualTypeOf trips vitest's constraint on object|undefined).
      expectTypeOf<OrchestratorResult['response']>().toMatchTypeOf<
        SynthesizedResponse | undefined
      >()
      expectTypeOf<OrchestratorResult['error']>().toMatchTypeOf<
        | undefined
        | {
            code: 'no_personas' | 'all_failed' | 'timeout' | 'invalid_input'
            message: string
            partialResults?: readonly PersonaAnalysis[]
          }
      >()
      // At runtime a success-shaped object still exposes response and omits error.
      const ok: OrchestratorResult = {
        success: true,
        response: buildSynthesizedResponse(),
        metadata: buildMetadata(),
      }
      expect(ok.response?.confidence).toBe(0.88)
      expect(ok.error).toBeUndefined()
    })

    it('top-level + nested fields are readonly (compile-time guard)', () => {
      const r: OrchestratorResult = {
        success: true,
        response: buildSynthesizedResponse(),
        metadata: buildMetadata(),
      }
      const tryMutate = (): void => {
        // @ts-expect-error "success is readonly: assignment errors with TS2540"
        r.success = false
      }
      void tryMutate
      expect(r.success).toBe(true)
    })
  })

  describe('OrchestratorEvent discriminated union', () => {
    it('exposes exactly the 8 documented event types', () => {
      expect(EVENT_TYPES).toHaveLength(8)
      expect(new Set(EVENT_TYPES).size).toBe(8)
    })

    it('the type discriminator is the 8-member literal union', () => {
      expectTypeOf<OrchestratorEvent['type']>().toEqualTypeOf<
        | 'intent_classified'
        | 'workflow_selected'
        | 'model_selected'
        | 'persona_started'
        | 'persona_completed'
        | 'persona_failed'
        | 'synthesis_completed'
        | 'orchestration_completed'
      >()
    })

    it('every arm is constructible with a well-typed payload', () => {
      const events: OrchestratorEvent[] = [
        { type: 'intent_classified', data: buildIntentClassification() },
        { type: 'workflow_selected', data: buildWorkflowDefinition() },
        { type: 'model_selected', data: buildSelectionResult() },
        { type: 'persona_started', data: { persona: 'cpa', stepId: 's1' } },
        { type: 'persona_completed', data: buildPersonaAnalysis('cpa') },
        { type: 'persona_failed', data: { persona: 'cfo', error: new Error('boom') } },
        { type: 'synthesis_completed', data: buildSynthesizedResponse() },
        {
          type: 'orchestration_completed',
          data: {
            success: true,
            response: buildSynthesizedResponse(),
            metadata: {
              workflowId: 'wf',
              intentClassification: buildIntentClassification(),
              modelSelection: buildSelectionResult(),
              timestamp: new Date(0),
            },
          },
        },
      ]
      expect(events).toHaveLength(8)
      expect(events.map((e) => e.type)).toEqual(EVENT_TYPES)
    })

    it('persona_failed carries a real Error instance', () => {
      const err = new Error('provider down')
      const ev: OrchestratorEvent = {
        type: 'persona_failed',
        data: { persona: 'tax_accountant', error: err },
      }
      if (ev.type === 'persona_failed') {
        expect(ev.data.error).toBeInstanceOf(Error)
        expect(ev.data.error.message).toBe('provider down')
        expect(ev.data.persona).toBe('tax_accountant')
      }
    })

    it('persona_started.data is the persona+stepId pair', () => {
      const ev: OrchestratorEvent = {
        type: 'persona_started',
        data: { persona: 'big4_auditor', stepId: 'audit' },
      }
      if (ev.type === 'persona_started') {
        expectTypeOf(ev.data).toEqualTypeOf<{ persona: PersonaType; stepId: string }>()
        expect(ev.data.stepId).toBe('audit')
      }
    })

    it('narrows the data shape per discriminator', () => {
      // Iterate over the typed union array so `ev` keeps the full 8-arm union
      // type — a single object literal would narrow `ev` to one arm and make the
      // other switch cases unreachable (TS2678).
      const events: OrchestratorEvent[] = [
        { type: 'intent_classified', data: buildIntentClassification() },
        { type: 'workflow_selected', data: buildWorkflowDefinition() },
        { type: 'model_selected', data: buildSelectionResult() },
        { type: 'persona_started', data: { persona: 'cpa', stepId: 's1' } },
        { type: 'persona_completed', data: buildPersonaAnalysis('cpa') },
        { type: 'persona_failed', data: { persona: 'cfo', error: new Error('boom') } },
        { type: 'synthesis_completed', data: buildSynthesizedResponse() },
        {
          type: 'orchestration_completed',
          data: {
            success: true,
            response: buildSynthesizedResponse(),
            metadata: {
              workflowId: 'wf',
              intentClassification: buildIntentClassification(),
              modelSelection: buildSelectionResult(),
              timestamp: new Date(0),
            },
          },
        },
      ]
      const seen: string[] = []
      for (const ev of events) {
        seen.push(ev.type)
        switch (ev.type) {
          case 'intent_classified':
            expectTypeOf(ev.data).toEqualTypeOf<IntentClassification>()
            expect(ev.data.primary).toBe('financial_analysis')
            break
          case 'workflow_selected':
            expectTypeOf(ev.data).toEqualTypeOf<WorkflowDefinition>()
            expect(ev.data.steps).toHaveLength(2)
            break
          case 'model_selected':
            expectTypeOf(ev.data).toEqualTypeOf<SelectionResult>()
            expect(ev.data.reason).toBe('best fit')
            break
          case 'persona_started':
            expectTypeOf(ev.data).toEqualTypeOf<{ persona: PersonaType; stepId: string }>()
            expect(ev.data.stepId).toBe('s1')
            break
          case 'persona_completed':
            expectTypeOf(ev.data).toEqualTypeOf<PersonaAnalysis>()
            expect(ev.data.persona).toBe('cpa')
            break
          case 'persona_failed':
            expectTypeOf(ev.data).toEqualTypeOf<{ persona: PersonaType; error: Error }>()
            expect(ev.data.error.message).toBe('boom')
            break
          case 'synthesis_completed':
            expectTypeOf(ev.data).toEqualTypeOf<SynthesizedResponse>()
            expect(ev.data.summary).toBe('summary')
            break
          case 'orchestration_completed':
            expectTypeOf(ev.data).toEqualTypeOf<OrchestratorResult>()
            expect(ev.data.success).toBe(true)
            break
        }
      }
      expect(seen).toEqual([...EVENT_TYPES])
    })
  })
})
