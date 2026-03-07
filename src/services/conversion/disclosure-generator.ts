import { prisma } from '@/lib/db'
import type {
  DisclosureCategory,
  DisclosureDocument,
  DisclosureSection,
  DisclosureStandardReference,
  ConversionRationale,
} from '@/types/conversion'
import {
  getTemplate,
  getCategories,
  type DisclosureTemplateContext,
  type TargetStandard,
} from '@/lib/conversion/disclosure-templates'
import { DisclosureAIEnhancer } from '@/lib/conversion/disclosure-ai-enhancer'

export interface GenerateDisclosureOptions {
  projectId: string
  category: DisclosureCategory
  context?: Partial<DisclosureTemplateContext>
}

export interface DisclosureWithRationales extends DisclosureDocument {
  rationales: ConversionRationale[]
}

export class DisclosureGenerator {
  private aiEnhancer: DisclosureAIEnhancer

  constructor() {
    this.aiEnhancer = new DisclosureAIEnhancer()
  }

  async generateAll(projectId: string): Promise<DisclosureDocument[]> {
    const project = await this.getProject(projectId)
    const targetStandard = this.parseTargetStandard(project.targetStandardId)
    const categories = getCategories(targetStandard)

    const results: DisclosureDocument[] = []

    for (const category of categories) {
      try {
        const doc = await this.generateByCategory(projectId, category as DisclosureCategory)
        if (doc) {
          results.push(doc)
        }
      } catch (error) {
        console.error(`[DisclosureGenerator] Failed to generate ${category}:`, error)
      }
    }

    return results
  }

  async generateByCategory(
    projectId: string,
    category: DisclosureCategory
  ): Promise<DisclosureDocument | null> {
    const project = await this.getProject(projectId)
    const targetStandard = this.parseTargetStandard(project.targetStandardId)
    const template = getTemplate(category, targetStandard)

    if (!template) {
      console.warn(`[DisclosureGenerator] No template found for category: ${category}`)
      return null
    }

    const context = await this.buildTemplateContext(projectId, project)
    const rationales = await this.getRationalesForCategory(projectId, category)

    const doc = await this.createOrUpdateDisclosure({
      projectId,
      category,
      title: template.title,
      titleEn: template.titleEn,
      content: template.generateContent(context),
      contentEn: template.generateContentEn(context),
      sections: template.generateSections(context),
      standardReferences: template.standardReferences.map((ref, idx) => ({
        id: `ref-${category}-${idx}`,
        referenceNumber: ref.referenceNumber,
        title: ref.title,
        source: ref.source,
        order: idx,
      })),
      rationaleIds: rationales.map((r) => r.id),
      isGenerated: true,
    })

    return doc
  }

  async generateSignificantAccountingPolicies(
    projectId: string
  ): Promise<DisclosureDocument | null> {
    return this.generateByCategory(projectId, 'significant_accounting_policies')
  }

  async generateStandardChangeDisclosure(projectId: string): Promise<DisclosureDocument | null> {
    return this.generateByCategory(projectId, 'basis_of_conversion')
  }

  async generateAdjustmentDisclosure(projectId: string): Promise<DisclosureDocument | null> {
    return this.generateByCategory(projectId, 'adjusting_entries')
  }

  async generateComparativeInformationDisclosure(
    projectId: string
  ): Promise<DisclosureDocument | null> {
    return this.generateByCategory(projectId, 'standard_differences')
  }

  async enhanceWithAI(disclosureId: string): Promise<DisclosureDocument | null> {
    const disclosure = await this.getById(disclosureId)
    if (!disclosure) {
      return null
    }

    const rationales = await this.getRationalesForCategory(
      disclosure.projectId,
      disclosure.category
    )

    const enhanced = await this.aiEnhancer.enhance(disclosure, rationales)

    const updated = await this.update(disclosureId, {
      content: enhanced.enhancedContent,
      contentEn: enhanced.enhancedContentEn,
      isAiEnhanced: true,
    })

    return updated
  }

  async getById(id: string): Promise<DisclosureDocument | null> {
    const doc = await prisma.disclosureDocument.findUnique({
      where: { id },
      include: {
        references: {
          orderBy: { sortOrder: 'asc' },
        },
        rationaleLinks: true,
      },
    })

    if (!doc) {
      return null
    }

    return this.mapToDisclosureDocument(doc)
  }

  async getByProject(projectId: string): Promise<DisclosureDocument[]> {
    const docs = await prisma.disclosureDocument.findMany({
      where: { projectId },
      include: {
        references: {
          orderBy: { sortOrder: 'asc' },
        },
        rationaleLinks: true,
      },
      orderBy: [{ sortOrder: 'asc' }],
    })

    return docs.map((doc) => this.mapToDisclosureDocument(doc))
  }

  async getByCategory(
    projectId: string,
    category: DisclosureCategory
  ): Promise<DisclosureDocument | null> {
    const doc = await prisma.disclosureDocument.findFirst({
      where: { projectId, category },
      include: {
        references: {
          orderBy: { sortOrder: 'asc' },
        },
        rationaleLinks: true,
      },
    })

    if (!doc) {
      return null
    }

    return this.mapToDisclosureDocument(doc)
  }

  async update(
    id: string,
    data: {
      content?: string
      contentEn?: string
      sections?: DisclosureSection[]
      isAiEnhanced?: boolean
      reviewedBy?: string
      reviewedAt?: Date
    }
  ): Promise<DisclosureDocument> {
    const doc = await prisma.disclosureDocument.update({
      where: { id },
      data: {
        content: data.content,
        contentEn: data.contentEn,
        sections: data.sections ? JSON.stringify(data.sections) : undefined,
        isAiEnhanced: data.isAiEnhanced,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt,
      },
      include: {
        references: {
          orderBy: { sortOrder: 'asc' },
        },
        rationaleLinks: true,
      },
    })

    return this.mapToDisclosureDocument(doc)
  }

  async review(id: string, userId: string): Promise<DisclosureDocument> {
    return this.update(id, {
      reviewedBy: userId,
      reviewedAt: new Date(),
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.disclosureDocument.delete({
      where: { id },
    })
  }

  async deleteByProject(projectId: string): Promise<void> {
    await prisma.disclosureDocument.deleteMany({
      where: { projectId },
    })
  }

  private async createOrUpdateDisclosure(data: {
    projectId: string
    category: DisclosureCategory
    title: string
    titleEn: string
    content: string
    contentEn: string
    sections: DisclosureSection[]
    standardReferences: DisclosureStandardReference[]
    rationaleIds: string[]
    isGenerated: boolean
  }): Promise<DisclosureDocument> {
    const existing = await prisma.disclosureDocument.findFirst({
      where: { projectId: data.projectId, category: data.category },
    })

    if (existing) {
      await prisma.disclosureStandardReference.deleteMany({
        where: { disclosureId: existing.id },
      })
      await prisma.disclosureRationaleLink.deleteMany({
        where: { disclosureId: existing.id },
      })

      const updated = await prisma.disclosureDocument.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          titleEn: data.titleEn,
          content: data.content,
          contentEn: data.contentEn,
          sections: JSON.stringify(data.sections),
          isGenerated: data.isGenerated,
          generatedAt: new Date(),
        },
        include: {
          references: true,
          rationaleLinks: true,
        },
      })

      await this.createReferences(updated.id, data.standardReferences)
      await this.createRationaleLinks(updated.id, data.rationaleIds)

      const result = await prisma.disclosureDocument.findUnique({
        where: { id: updated.id },
        include: {
          references: { orderBy: { sortOrder: 'asc' } },
          rationaleLinks: true,
        },
      })

      return this.mapToDisclosureDocument(result!)
    }

    const created = await prisma.disclosureDocument.create({
      data: {
        projectId: data.projectId,
        category: data.category,
        title: data.title,
        titleEn: data.titleEn,
        content: data.content,
        contentEn: data.contentEn,
        sections: JSON.stringify(data.sections),
        isGenerated: data.isGenerated,
      },
      include: {
        references: true,
        rationaleLinks: true,
      },
    })

    await this.createReferences(created.id, data.standardReferences)
    await this.createRationaleLinks(created.id, data.rationaleIds)

    const result = await prisma.disclosureDocument.findUnique({
      where: { id: created.id },
      include: {
        references: { orderBy: { sortOrder: 'asc' } },
        rationaleLinks: true,
      },
    })

    return this.mapToDisclosureDocument(result!)
  }

  private async createReferences(
    disclosureId: string,
    references: DisclosureStandardReference[]
  ): Promise<void> {
    for (const ref of references) {
      await prisma.disclosureStandardReference.create({
        data: {
          disclosureId,
          referenceNumber: ref.referenceNumber,
          title: ref.title,
          source: ref.source,
          sortOrder: ref.order ?? 0,
        },
      })
    }
  }

  private async createRationaleLinks(disclosureId: string, rationaleIds: string[]): Promise<void> {
    for (const rationaleId of rationaleIds) {
      await prisma.disclosureRationaleLink
        .create({
          data: {
            disclosureId,
            rationaleId,
          },
        })
        .catch(() => {
          // Ignore duplicate errors
        })
    }
  }

  private async getProject(projectId: string) {
    const project = await prisma.conversionProject.findUnique({
      where: { id: projectId },
      include: {
        sourceStandard: true,
        targetStandard: true,
        company: true,
      },
    })

    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    return project
  }

  private async buildTemplateContext(
    projectId: string,
    project: {
      id: string
      targetStandardId: string
      periodStart: Date
      periodEnd: Date
      company: { name: string } | null
    }
  ): Promise<DisclosureTemplateContext> {
    const targetStandard = this.parseTargetStandard(project.targetStandardId)
    const adjustments = await this.getAdjustments(projectId)
    const rationales = await prisma.conversionRationale.findMany({
      where: { projectId },
      take: 20,
    })

    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    const context: DisclosureTemplateContext = {
      targetStandard: targetStandard === 'USGAAP' ? 'US GAAP' : 'IFRS',
      periodStart: formatDate(project.periodStart),
      periodEnd: formatDate(project.periodEnd),
      companyName: project.company?.name ?? '当社',
      adjustmentsPresent: adjustments.length > 0,
      adjustmentList: this.formatAdjustmentList(adjustments),
      standardReferences: this.formatStandardReferences(rationales),
      differenceSections: this.formatDifferenceSections(rationales),
      differenceTable: this.formatDifferenceTable(adjustments),
      adjustmentDetails: this.formatAdjustmentDetails(adjustments),
      impactTable: this.formatImpactTable(adjustments),
      references: this.formatReferences(rationales),
    }

    return context
  }

  private async getAdjustments(projectId: string) {
    return prisma.adjustingEntry.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    })
  }

  private async getRationalesForCategory(
    projectId: string,
    category: DisclosureCategory
  ): Promise<ConversionRationale[]> {
    const rationales = await prisma.conversionRationale.findMany({
      where: {
        projectId,
        rationaleType: this.mapCategoryToRationaleType(category),
      },
      take: 50,
    })

    return rationales.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      entityType: r.entityType as ConversionRationale['entityType'],
      entityId: r.entityId,
      rationaleType: r.rationaleType as ConversionRationale['rationaleType'],
      summary: r.summary,
      summaryEn: r.summaryEn ?? undefined,
      detailedExplanation: r.detailedExplanation ?? undefined,
      detailedExplanationEn: r.detailedExplanationEn ?? undefined,
      impactAmount: r.impactAmount ?? undefined,
      impactDirection: (r.impactDirection as ConversionRationale['impactDirection']) ?? undefined,
      isAiGenerated: r.isAiGenerated,
      aiModelUsed: r.aiModelUsed ?? undefined,
      aiConfidence: r.aiConfidence ?? undefined,
      isReviewed: r.isReviewed,
      reviewedBy: r.reviewedBy ?? undefined,
      reviewedAt: r.reviewedAt ?? undefined,
      createdBy: r.createdBy ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  private mapCategoryToRationaleType(category: DisclosureCategory): string {
    const mapping: Record<string, string> = {
      significant_accounting_policies: 'disclosure_requirement',
      basis_of_conversion: 'difference_explanation',
      standard_differences: 'difference_explanation',
      adjusting_entries: 'adjustment_reason',
      fair_value_measurement: 'measurement_change',
    }
    return mapping[category] ?? 'disclosure_requirement'
  }

  private parseTargetStandard(standardId: string): TargetStandard {
    if (
      standardId.toLowerCase().includes('usgaap') ||
      standardId.toLowerCase().includes('us-gaap')
    ) {
      return 'USGAAP'
    }
    if (standardId.toLowerCase().includes('ifrs')) {
      return 'IFRS'
    }
    return 'USGAAP'
  }

  private formatAdjustmentList(adjustments: { description: string }[]): string {
    if (adjustments.length === 0) return ''
    return adjustments.map((a, i) => `${i + 1}. ${a.description}`).join('\n')
  }

  private formatStandardReferences(rationales: { summary: string }[]): string {
    if (rationales.length === 0) return ''
    return rationales
      .map((r) => `- ${r.summary}`)
      .slice(0, 10)
      .join('\n')
  }

  private formatDifferenceSections(
    rationales: { summary: string; detailedExplanation: string | null }[]
  ): string {
    if (rationales.length === 0) return ''
    return rationales
      .filter((r) => r.detailedExplanation)
      .map((r) => `### ${r.summary}\n${r.detailedExplanation}`)
      .slice(0, 5)
      .join('\n\n')
  }

  private formatDifferenceTable(adjustments: { description: string }[]): string {
    if (adjustments.length === 0) return '| データなし | - | - | - |'
    return adjustments
      .map((a) => `| ${a.description} | - | - | - |`)
      .slice(0, 10)
      .join('\n')
  }

  private formatAdjustmentDetails(adjustments: { description: string; type: string }[]): string {
    if (adjustments.length === 0) return ''
    return adjustments.map((a) => `### ${a.type}\n${a.description}`).join('\n\n')
  }

  private formatImpactTable(adjustments: { description: string }[]): string {
    if (adjustments.length === 0) return '| データなし | - | - | - |'
    return adjustments
      .map((a) => `| ${a.description} | - | - | - |`)
      .slice(0, 10)
      .join('\n')
  }

  private formatReferences(rationales: { summary: string }[]): string {
    if (rationales.length === 0) return ''
    return rationales
      .map((r) => `- ${r.summary}`)
      .slice(0, 5)
      .join('\n')
  }

  private mapToDisclosureDocument(doc: {
    id: string
    projectId: string
    category: string
    title: string
    titleEn: string
    content: string
    contentEn: string | null
    sections: string | null
    isGenerated: boolean
    isAiEnhanced: boolean
    generatedAt: Date
    updatedAt: Date
    reviewedBy: string | null
    reviewedAt: Date | null
    sortOrder: number
    references: Array<{
      id: string
      referenceNumber: string
      title: string
      source: string
      sortOrder: number
    }>
    rationaleLinks: Array<{ rationaleId: string }>
  }): DisclosureDocument {
    return {
      id: doc.id,
      projectId: doc.projectId,
      category: doc.category as DisclosureCategory,
      title: doc.title,
      titleEn: doc.titleEn,
      content: doc.content,
      contentEn: doc.contentEn ?? undefined,
      sections: doc.sections ? JSON.parse(doc.sections) : [],
      standardReferences: doc.references.map((ref) => ({
        id: ref.id,
        referenceNumber: ref.referenceNumber,
        title: ref.title,
        source: ref.source,
        order: ref.sortOrder,
      })),
      relatedRationaleIds: doc.rationaleLinks.map((link) => link.rationaleId),
      isGenerated: doc.isGenerated,
      isAiEnhanced: doc.isAiEnhanced,
      generatedAt: doc.generatedAt,
      updatedAt: doc.updatedAt,
      reviewedBy: doc.reviewedBy ?? undefined,
      reviewedAt: doc.reviewedAt ?? undefined,
      sortOrder: doc.sortOrder,
    }
  }
}

export const disclosureGenerator = new DisclosureGenerator()
