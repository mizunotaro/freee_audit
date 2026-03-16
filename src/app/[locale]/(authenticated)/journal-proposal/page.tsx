'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { ReceiptUploader } from './components/ReceiptUploader'
import { OcrPreview } from './components/OcrPreview'
import { ProposalList } from './components/ProposalList'
import { ProposalCard } from './components/ProposalCard'
import { ProposalEditor } from './components/ProposalEditor'
import { ProposalActions } from './components/ProposalActions'
import { FallbackInput } from './components/FallbackInput'
import { StatusBadge } from '@/components/journal-proposal'
import type { ProposalStatus } from '@/components/journal-proposal'
import type { JournalProposalOutput, JournalProposal } from '@/types/journal-proposal'
import type { AppError } from '@/lib/journal-proposal'
import { journalProposalApi, type ManualInputData } from '@/services/journal-proposal'
import { JOURNAL_PROPOSAL_CONFIG } from '@/config/journal-proposal'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type ViewMode = 'upload' | 'detail'

interface PageState {
  viewMode: ViewMode
  isProcessing: boolean
  currentProposal: JournalProposalOutput | null
  selectedProposalIndex: number
  editingProposal: JournalProposal | null
  proposalStatus: ProposalStatus
  error: AppError | null
  showFallback: boolean
  ocrError: string | null
}

const initialState: PageState = {
  viewMode: 'upload',
  isProcessing: false,
  currentProposal: null,
  selectedProposalIndex: 0,
  editingProposal: null,
  proposalStatus: 'draft',
  error: null,
  showFallback: false,
  ocrError: null,
}

export default function JournalProposalPage() {
  const t = useTranslations('journalProposal')
  const [state, setState] = useState<PageState>(initialState)
  const [mockProposals] = useState<Array<JournalProposalOutput & { status: ProposalStatus }>>([])

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  const handleUpload = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      isProcessing: true,
      error: null,
      showFallback: false,
      ocrError: null,
    }))

    const result = await journalProposalApi.analyzeDocument({
      file,
      companyId: JOURNAL_PROPOSAL_CONFIG.defaults.companyId,
      userId: JOURNAL_PROPOSAL_CONFIG.defaults.userId,
      userContext: JOURNAL_PROPOSAL_CONFIG.defaults.userContext,
    })

    if (!result.success) {
      if (result.error.code === 'OCR_FAILED' || result.error.code === 'PARSE_ERROR') {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          showFallback: true,
          ocrError: result.error.message,
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: result.error,
      }))
      return
    }

    const proposal: JournalProposalOutput = {
      documentId: result.data.documentId,
      ocrResult: result.data.ocrResult,
      proposals: result.data.proposals,
      generatedAt: result.data.generatedAt,
      aiProvider: result.data.aiProvider,
      aiModel: result.data.aiModel,
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      currentProposal: proposal,
      selectedProposalIndex: 0,
      proposalStatus: 'pending',
      viewMode: 'detail',
    }))
  }, [])

  const handleSelectProposal = useCallback(
    (proposal: JournalProposalOutput & { status?: ProposalStatus }) => {
      setState((prev) => ({
        ...prev,
        currentProposal: proposal,
        selectedProposalIndex: 0,
        proposalStatus: proposal.status || 'pending',
        viewMode: 'detail',
        editingProposal: null,
      }))
    },
    []
  )

  const handleApprove = useCallback(async () => {
    if (!state.currentProposal) return

    setState((prev) => ({ ...prev, isProcessing: true }))
    const result = await journalProposalApi.approveProposal(
      state.currentProposal.documentId,
      state.currentProposal.proposals[0]?.id || ''
    )

    if (!result.success) {
      setState((prev) => ({ ...prev, isProcessing: false, error: result.error }))
      return
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      proposalStatus: 'approved',
    }))
  }, [state.currentProposal])

  const handleReject = useCallback(async () => {
    if (!state.currentProposal) return

    setState((prev) => ({ ...prev, isProcessing: true }))
    const result = await journalProposalApi.rejectProposal(
      state.currentProposal.documentId,
      state.currentProposal.proposals[0]?.id || ''
    )

    if (!result.success) {
      setState((prev) => ({ ...prev, isProcessing: false, error: result.error }))
      return
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      proposalStatus: 'rejected',
    }))
  }, [state.currentProposal])

  const handleRegenerate = useCallback(async () => {
    console.log('[JournalProposal] Regenerate proposals')
  }, [])

  const handleExportToFreee = useCallback(async () => {
    if (!state.currentProposal) return
    setState((prev) => ({ ...prev, proposalStatus: 'exported' }))
    console.log('[JournalProposal] Export to freee:', state.currentProposal.documentId)
  }, [state.currentProposal])

  const handleEditProposal = useCallback((proposal: JournalProposal) => {
    setState((prev) => ({ ...prev, editingProposal: proposal }))
  }, [])

  const handleSaveEdit = useCallback(
    (proposal: JournalProposal) => {
      if (!state.currentProposal) return
      setState((prev) => ({
        ...prev,
        currentProposal: {
          ...prev.currentProposal!,
          proposals: prev.currentProposal!.proposals.map((p) =>
            p.id === proposal.id ? proposal : p
          ),
        },
        editingProposal: null,
      }))
    },
    [state.currentProposal]
  )

  const handleBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      viewMode: 'upload',
      currentProposal: null,
      editingProposal: null,
      error: null,
      showFallback: false,
      ocrError: null,
    }))
  }, [])

  const handleFallbackSubmit = useCallback(async (data: ManualInputData) => {
    setState((prev) => ({ ...prev, isProcessing: true }))

    const result = await journalProposalApi.analyzeWithManualInput({
      companyId: JOURNAL_PROPOSAL_CONFIG.defaults.companyId,
      manualData: data,
    })

    if (!result.success) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: result.error,
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      currentProposal: result.data,
      showFallback: false,
      viewMode: 'detail',
      proposalStatus: 'pending',
    }))
  }, [])

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        {state.viewMode === 'detail' && state.currentProposal && (
          <div className="flex items-center gap-4">
            <StatusBadge status={state.proposalStatus} />
            <ProposalActions
              proposal={state.currentProposal}
              onApprove={handleApprove}
              onReject={handleReject}
              onRegenerate={handleRegenerate}
              onExportToFreee={handleExportToFreee}
              isProcessing={state.isProcessing}
            />
          </div>
        )}
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertTitle>{t('errors.analysisFailed')}</AlertTitle>
          <AlertDescription>
            {state.error.message}
            <button onClick={clearError} className="ml-2 underline">
              {t('actions.cancel')}
            </button>
          </AlertDescription>
        </Alert>
      )}

      {state.viewMode === 'upload' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ReceiptUploader onUpload={handleUpload} isProcessing={state.isProcessing} />
            {state.showFallback && (
              <div className="mt-4">
                <FallbackInput onSubmit={handleFallbackSubmit} isProcessing={state.isProcessing} />
              </div>
            )}
          </div>
          <div className="lg:col-span-2">
            <ProposalList proposals={mockProposals} onSelectProposal={handleSelectProposal} />
          </div>
        </div>
      )}

      {state.viewMode === 'detail' && state.currentProposal && (
        <div className="space-y-6">
          <button
            onClick={handleBack}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to list
          </button>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <OcrPreview ocrResult={state.currentProposal.ocrResult} />
            </div>

            <div className="space-y-4 lg:col-span-2">
              {state.editingProposal ? (
                <ProposalEditor
                  proposal={state.editingProposal}
                  onSave={handleSaveEdit}
                  onCancel={() => setState((prev) => ({ ...prev, editingProposal: null }))}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {state.currentProposal.proposals.map((proposal, index) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      isSelected={state.selectedProposalIndex === index}
                      onSelect={() =>
                        setState((prev) => ({ ...prev, selectedProposalIndex: index }))
                      }
                      onEdit={handleEditProposal}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                AI Model: {state.currentProposal.aiProvider} / {state.currentProposal.aiModel}
                <br />
                Generated: {new Date(state.currentProposal.generatedAt).toLocaleString('ja-JP')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
