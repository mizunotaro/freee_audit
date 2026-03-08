export type {
  Result,
  JournalProposalInput,
  JournalProposalOutput,
  JournalEntryProposal,
  ProposalStatus,
  StoreMetadata,
  ProposalFilters,
  AIProposalResponse,
  ChartOfAccountItem,
} from './types'

export { JOURNAL_PROPOSAL_PROMPT, PROMPT_VERSION } from './prompts/journal-proposal'

export { JournalProposalService, journalProposalService } from './journal-proposal-service'
