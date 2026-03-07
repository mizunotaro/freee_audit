import { prisma } from '@/lib/db'
import { PDFExporter } from '@/lib/conversion/exporters/pdf-exporter'
import { ExcelExporter } from '@/lib/conversion/exporters/excel-exporter'
import { CSVExporter } from '@/lib/conversion/exporters/csv-exporter'
import { JSONExporter } from '@/lib/conversion/exporters/json-exporter'
import type { Exporter, ExporterContext } from '@/lib/conversion/exporters/types'
import type { ConversionResult, ExportConfig, ExportResult } from '@/types/conversion'
import { randomUUID } from 'crypto'

const EXPORT_EXPIRY_HOURS = 24

export class ConversionExportService {
  private exporters: Record<string, Exporter>

  constructor() {
    this.exporters = {
      pdf: new PDFExporter(),
      excel: new ExcelExporter(),
      csv: new CSVExporter(),
      json: new JSONExporter(),
    }
  }

  async export(projectId: string, config: ExportConfig, userId?: string): Promise<ExportResult> {
    const { result, context } = await this.loadConversionData(projectId)

    if (!result) {
      throw new Error('Conversion result not found. Please run conversion first.')
    }

    const exporter = this.exporters[config.format]
    if (!exporter) {
      throw new Error(`Unsupported export format: ${config.format}`)
    }

    const { buffer, fileName, mimeType } = await exporter.export(result, config, context)

    const exportRecord = await this.saveExportRecord(
      result.id,
      config,
      fileName,
      buffer.length,
      userId
    )

    const fileUrl = await this.storeFile(exportRecord.id, buffer, fileName, mimeType)

    return {
      id: exportRecord.id,
      projectId,
      format: config.format,
      fileUrl,
      fileName,
      fileSize: buffer.length,
      generatedAt: exportRecord.generatedAt,
      expiresAt: exportRecord.expiresAt ?? undefined,
    }
  }

  async getExportHistory(projectId: string): Promise<ExportResult[]> {
    const exports = await prisma.conversionExport.findMany({
      where: {
        result: {
          projectId,
        },
      },
      orderBy: {
        generatedAt: 'desc',
      },
      take: 20,
    })

    return exports.map((e) => ({
      id: e.id,
      projectId,
      format: e.format,
      fileName: e.fileName,
      fileSize: e.fileSize,
      generatedAt: e.generatedAt,
      expiresAt: e.expiresAt ?? undefined,
    }))
  }

  async getExportById(
    exportId: string
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string } | null> {
    const exportRecord = await prisma.conversionExport.findUnique({
      where: { id: exportId },
    })

    if (!exportRecord || !exportRecord.filePath) {
      return null
    }

    if (exportRecord.expiresAt && exportRecord.expiresAt < new Date()) {
      return null
    }

    const file = await this.retrieveFile(exportRecord.filePath)
    if (!file) {
      return null
    }

    const mimeType = this.getMimeType(exportRecord.format)

    return {
      buffer: file,
      fileName: exportRecord.fileName,
      mimeType,
    }
  }

  async deleteExpiredExports(): Promise<number> {
    const expired = await prisma.conversionExport.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    for (const exp of expired) {
      if (exp.filePath) {
        await this.deleteFile(exp.filePath)
      }
    }

    const result = await prisma.conversionExport.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    return result.count
  }

  private async loadConversionData(
    projectId: string
  ): Promise<{ result: ConversionResult | null; context: ExporterContext }> {
    const project = await prisma.conversionProject.findUnique({
      where: { id: projectId },
      include: {
        company: true,
        sourceStandard: true,
        targetStandard: true,
        results: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    const latestResult = project.results[0]

    const context: ExporterContext = {
      projectId: project.id,
      projectName: project.name,
      companyName: project.company.name,
      sourceStandard: project.sourceStandard.code,
      targetStandard: project.targetStandard.code,
      periodStart: project.periodStart,
      periodEnd: project.periodEnd,
    }

    if (!latestResult) {
      return { result: null, context }
    }

    const result: ConversionResult = {
      id: latestResult.id,
      projectId: latestResult.projectId,
      journalConversions: latestResult.journalConversions
        ? JSON.parse(latestResult.journalConversions)
        : undefined,
      balanceSheet: latestResult.balanceSheet ? JSON.parse(latestResult.balanceSheet) : undefined,
      profitLoss: latestResult.profitLoss ? JSON.parse(latestResult.profitLoss) : undefined,
      cashFlow: latestResult.cashFlow ? JSON.parse(latestResult.cashFlow) : undefined,
      conversionDate: latestResult.conversionDate,
      conversionDurationMs: latestResult.conversionDurationMs,
      warnings: latestResult.warnings ? JSON.parse(latestResult.warnings) : [],
      errors: latestResult.errors ? JSON.parse(latestResult.errors) : [],
    }

    return { result, context }
  }

  private async saveExportRecord(
    resultId: string,
    config: ExportConfig,
    fileName: string,
    fileSize: number,
    userId?: string
  ): Promise<{ id: string; generatedAt: Date; expiresAt: Date | null }> {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + EXPORT_EXPIRY_HOURS)

    const exportRecord = await prisma.conversionExport.create({
      data: {
        id: randomUUID(),
        resultId,
        format: config.format,
        config: JSON.stringify(config),
        fileName,
        fileSize,
        generatedBy: userId,
        expiresAt,
      },
    })

    return {
      id: exportRecord.id,
      generatedAt: exportRecord.generatedAt,
      expiresAt: exportRecord.expiresAt,
    }
  }

  private async storeFile(
    exportId: string,
    _buffer: Buffer,
    fileName: string,
    _mimeType: string
  ): Promise<string> {
    const filePath = `exports/${exportId}/${fileName}`

    await prisma.conversionExport.update({
      where: { id: exportId },
      data: {
        filePath,
      },
    })

    return `/api/conversion/download/${exportId}`
  }

  private async retrieveFile(_filePath: string): Promise<Buffer | null> {
    console.log('Would retrieve file from storage')
    return null
  }

  private async deleteFile(_filePath: string): Promise<void> {
    console.log('Would delete file from storage')
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json',
    }
    return mimeTypes[format] ?? 'application/octet-stream'
  }
}

export const conversionExportService = new ConversionExportService()
