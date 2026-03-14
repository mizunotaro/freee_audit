import { prisma } from '@/lib/db'
import type { PeerCompany } from '@prisma/client'
import type {
  CreatePeerCompanyInput,
  UpdatePeerCompanyInput,
  PeerCompanyFilter,
  PeerCompanyListItem,
  Result,
} from './types'

function toListItem(peer: PeerCompany): PeerCompanyListItem {
  return {
    id: peer.id,
    ticker: peer.ticker,
    name: peer.name,
    nameEn: peer.nameEn,
    exchange: peer.exchange,
    industry: peer.industry,
    marketCap: peer.marketCap,
    revenue: peer.revenue,
    employees: peer.employees,
    per: peer.per,
    pbr: peer.pbr,
    evEbitda: peer.evEbitda,
    psr: peer.psr,
    beta: peer.beta,
    similarityScore: peer.similarityScore,
    dataSource: peer.dataSource,
    isActive: peer.isActive,
    createdAt: peer.createdAt,
    updatedAt: peer.updatedAt,
  }
}

export class PeerCompanyService {
  async create(
    companyId: string,
    input: CreatePeerCompanyInput
  ): Promise<Result<PeerCompanyListItem>> {
    try {
      if (input.ticker) {
        const existing = await prisma.peerCompany.findUnique({
          where: {
            companyId_ticker: {
              companyId,
              ticker: input.ticker,
            },
          },
        })
        if (existing) {
          return {
            success: false,
            error: {
              code: 'duplicate_ticker',
              message: `Peer company with ticker ${input.ticker} already exists`,
            },
          }
        }
      }

      const peer = await prisma.peerCompany.create({
        data: {
          companyId,
          ticker: input.ticker ?? null,
          name: input.name,
          nameEn: input.nameEn ?? null,
          exchange: input.exchange ?? null,
          industry: input.industry ?? null,
          marketCap: input.marketCap ?? null,
          revenue: input.revenue ?? null,
          employees: input.employees ?? null,
          per: input.per ?? null,
          pbr: input.pbr ?? null,
          evEbitda: input.evEbitda ?? null,
          psr: input.psr ?? null,
          beta: input.beta ?? null,
          similarityScore: input.similarityScore ?? null,
          dataSource: input.dataSource ?? 'manual',
          sourceUrl: input.sourceUrl ?? null,
          isActive: true,
        },
      })

      return { success: true, data: toListItem(peer) }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'create_failed',
          message: error instanceof Error ? error.message : 'Failed to create peer company',
        },
      }
    }
  }

  async findById(companyId: string, peerId: string): Promise<Result<PeerCompanyListItem>> {
    try {
      const peer = await prisma.peerCompany.findFirst({
        where: { id: peerId, companyId },
      })

      if (!peer) {
        return {
          success: false,
          error: {
            code: 'not_found',
            message: 'Peer company not found',
          },
        }
      }

      return { success: true, data: toListItem(peer) }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'find_failed',
          message: error instanceof Error ? error.message : 'Failed to find peer company',
        },
      }
    }
  }

  async list(
    companyId: string,
    filter?: PeerCompanyFilter
  ): Promise<Result<PeerCompanyListItem[]>> {
    try {
      const where = {
        companyId,
        ...(filter?.activeOnly !== undefined && { isActive: filter.activeOnly }),
        ...(filter?.industry && { industry: filter.industry }),
        ...(filter?.minSimilarityScore !== undefined && {
          similarityScore: { gte: filter.minSimilarityScore },
        }),
      }

      const peers = await prisma.peerCompany.findMany({
        where,
        orderBy: [{ similarityScore: 'desc' }, { name: 'asc' }],
      })

      return { success: true, data: peers.map(toListItem) }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'list_failed',
          message: error instanceof Error ? error.message : 'Failed to list peer companies',
        },
      }
    }
  }

  async update(
    companyId: string,
    peerId: string,
    input: UpdatePeerCompanyInput
  ): Promise<Result<PeerCompanyListItem>> {
    try {
      const existing = await prisma.peerCompany.findFirst({
        where: { id: peerId, companyId },
      })

      if (!existing) {
        return {
          success: false,
          error: {
            code: 'not_found',
            message: 'Peer company not found',
          },
        }
      }

      if (input.ticker && input.ticker !== existing.ticker) {
        const duplicate = await prisma.peerCompany.findUnique({
          where: {
            companyId_ticker: {
              companyId,
              ticker: input.ticker,
            },
          },
        })
        if (duplicate) {
          return {
            success: false,
            error: {
              code: 'duplicate_ticker',
              message: `Peer company with ticker ${input.ticker} already exists`,
            },
          }
        }
      }

      const peer = await prisma.peerCompany.update({
        where: { id: peerId },
        data: {
          ...(input.ticker !== undefined && { ticker: input.ticker ?? null }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.nameEn !== undefined && { nameEn: input.nameEn ?? null }),
          ...(input.exchange !== undefined && { exchange: input.exchange ?? null }),
          ...(input.industry !== undefined && { industry: input.industry ?? null }),
          ...(input.marketCap !== undefined && { marketCap: input.marketCap ?? null }),
          ...(input.revenue !== undefined && { revenue: input.revenue ?? null }),
          ...(input.employees !== undefined && { employees: input.employees ?? null }),
          ...(input.per !== undefined && { per: input.per ?? null }),
          ...(input.pbr !== undefined && { pbr: input.pbr ?? null }),
          ...(input.evEbitda !== undefined && { evEbitda: input.evEbitda ?? null }),
          ...(input.psr !== undefined && { psr: input.psr ?? null }),
          ...(input.beta !== undefined && { beta: input.beta ?? null }),
          ...(input.similarityScore !== undefined && {
            similarityScore: input.similarityScore ?? null,
          }),
          ...(input.dataSource !== undefined && { dataSource: input.dataSource }),
          ...(input.sourceUrl !== undefined && { sourceUrl: input.sourceUrl ?? null }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      })

      return { success: true, data: toListItem(peer) }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'update_failed',
          message: error instanceof Error ? error.message : 'Failed to update peer company',
        },
      }
    }
  }

  async delete(companyId: string, peerId: string): Promise<Result<void>> {
    try {
      const existing = await prisma.peerCompany.findFirst({
        where: { id: peerId, companyId },
      })

      if (!existing) {
        return {
          success: false,
          error: {
            code: 'not_found',
            message: 'Peer company not found',
          },
        }
      }

      await prisma.peerCompany.delete({
        where: { id: peerId },
      })

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'delete_failed',
          message: error instanceof Error ? error.message : 'Failed to delete peer company',
        },
      }
    }
  }

  async bulkCreate(
    companyId: string,
    inputs: CreatePeerCompanyInput[]
  ): Promise<Result<{ created: number; skipped: number; items: PeerCompanyListItem[] }>> {
    try {
      const created: PeerCompany[] = []
      let skipped = 0

      for (const input of inputs) {
        if (input.ticker) {
          const existing = await prisma.peerCompany.findUnique({
            where: {
              companyId_ticker: {
                companyId,
                ticker: input.ticker,
              },
            },
          })
          if (existing) {
            skipped++
            continue
          }
        }

        const peer = await prisma.peerCompany.create({
          data: {
            companyId,
            ticker: input.ticker ?? null,
            name: input.name,
            nameEn: input.nameEn ?? null,
            exchange: input.exchange ?? null,
            industry: input.industry ?? null,
            marketCap: input.marketCap ?? null,
            revenue: input.revenue ?? null,
            employees: input.employees ?? null,
            per: input.per ?? null,
            pbr: input.pbr ?? null,
            evEbitda: input.evEbitda ?? null,
            psr: input.psr ?? null,
            beta: input.beta ?? null,
            similarityScore: input.similarityScore ?? null,
            dataSource: input.dataSource ?? 'manual',
            sourceUrl: input.sourceUrl ?? null,
            isActive: true,
          },
        })
        created.push(peer)
      }

      return {
        success: true,
        data: {
          created: created.length,
          skipped,
          items: created.map(toListItem),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'bulk_create_failed',
          message: error instanceof Error ? error.message : 'Failed to bulk create peer companies',
        },
      }
    }
  }

  async setSimilarityScores(
    companyId: string,
    scores: { peerId: string; score: number }[]
  ): Promise<Result<void>> {
    try {
      await prisma.$transaction(
        scores.map(({ peerId, score }) =>
          prisma.peerCompany.updateMany({
            where: { id: peerId, companyId },
            data: { similarityScore: score },
          })
        )
      )

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'update_scores_failed',
          message: error instanceof Error ? error.message : 'Failed to update similarity scores',
        },
      }
    }
  }
}

export function createPeerCompanyService(): PeerCompanyService {
  return new PeerCompanyService()
}
