import { prisma } from '@/lib/db'
import { failure, createAppError, tryCatch, type Result, type AppError } from '@/types/result'

export interface CreateProcurementCaseOptions {
  companyId: string
  title: string
  vendor?: string
  costCategory: string
  totalAmount: number
  currency?: string
  subsidyProjectId?: string
}

export interface AddProcurementDocumentOptions {
  caseId: string
  documentType: string
  amount?: number
  taxAmount?: number
  date?: Date
  vendorName?: string
  description?: string
  filePath?: string
  fileSource?: string
}

export interface ProcurementConsistencyResult {
  caseId: string
  isConsistent: boolean
  alerts: ProcurementAlertItem[]
}

export interface ProcurementAlertItem {
  alertType: string
  severity: string
  message: string
  field1?: string
  field2?: string
}

const COST_CATEGORIES = [
  'outsource',
  'consignment',
  'goods',
  'personnel',
  'honorarium',
  'travel',
  'other',
] as const
const DOCUMENT_TYPES = [
  'specification',
  'quotation',
  'selection_reason',
  'purchase_order',
  'contract',
  'delivery_note',
  'inspection_report',
  'invoice',
  'payment_proof',
] as const
const COMPETITION_THRESHOLD = 1000000

export async function createProcurementCase(
  options: CreateProcurementCaseOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.companyId || !options.title) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId and title are required'))
  }

  if (!COST_CATEGORIES.includes(options.costCategory as (typeof COST_CATEGORIES)[number])) {
    return failure(
      createAppError(
        'VALIDATION_ERROR',
        `Invalid costCategory. Must be one of: ${COST_CATEGORIES.join(', ')}`
      )
    )
  }

  if (options.totalAmount < 0) {
    return failure(createAppError('VALIDATION_ERROR', 'totalAmount must be non-negative'))
  }

  const competitionRequired = options.totalAmount >= COMPETITION_THRESHOLD

  return tryCatch(async () => {
    const procurement = await prisma.procurementCase.create({
      data: {
        companyId: options.companyId,
        title: options.title,
        vendor: options.vendor,
        costCategory: options.costCategory,
        totalAmount: options.totalAmount,
        currency: options.currency ?? 'JPY',
        competitionRequired,
        subsidyProjectId: options.subsidyProjectId,
        status: 'draft',
      },
    })
    return { id: procurement.id }
  }, 'DATABASE_ERROR')
}

export async function addProcurementDocument(
  options: AddProcurementDocumentOptions
): Promise<Result<{ id: string }, AppError>> {
  if (!options.caseId || !options.documentType) {
    return failure(createAppError('VALIDATION_ERROR', 'caseId and documentType are required'))
  }

  if (!DOCUMENT_TYPES.includes(options.documentType as (typeof DOCUMENT_TYPES)[number])) {
    return failure(
      createAppError(
        'VALIDATION_ERROR',
        `Invalid documentType. Must be one of: ${DOCUMENT_TYPES.join(', ')}`
      )
    )
  }

  return tryCatch(async () => {
    const doc = await prisma.procurementDocument.create({
      data: {
        caseId: options.caseId,
        documentType: options.documentType,
        amount: options.amount,
        taxAmount: options.taxAmount,
        date: options.date,
        vendorName: options.vendorName,
        description: options.description,
        filePath: options.filePath,
        fileSource: options.fileSource,
      },
    })
    return { id: doc.id }
  }, 'DATABASE_ERROR')
}

export async function checkProcurementConsistency(
  caseId: string
): Promise<Result<ProcurementConsistencyResult, AppError>> {
  if (!caseId) {
    return failure(createAppError('VALIDATION_ERROR', 'caseId is required'))
  }

  const procurement = await prisma.procurementCase.findUnique({
    where: { id: caseId },
    include: { documents: true },
  })

  if (!procurement) {
    return failure(createAppError('NOT_FOUND', 'Procurement case not found'))
  }

  return tryCatch(async () => {
    const alerts: ProcurementAlertItem[] = []
    const docs = procurement.documents

    const quotations = docs.filter((d) => d.documentType === 'quotation')
    const purchaseOrders = docs.filter((d) => d.documentType === 'purchase_order')
    const deliveryNotes = docs.filter((d) => d.documentType === 'delivery_note')
    const invoices = docs.filter((d) => d.documentType === 'invoice')

    if (procurement.competitionRequired && quotations.length < 2) {
      alerts.push({
        alertType: 'missing_quotations',
        severity: 'high',
        message: `100万円以上の案件には2社以上の見積が必要です（現在: ${quotations.length}社）`,
      })
    }

    if (procurement.competitionRequired) {
      const selectionReasons = docs.filter((d) => d.documentType === 'selection_reason')
      if (selectionReasons.length === 0) {
        alerts.push({
          alertType: 'missing_selection_reason',
          severity: 'high',
          message: '100万円以上の案件には選定理由書が必要です',
        })
      }
    }

    if (purchaseOrders.length === 0 && procurement.totalAmount >= 500000) {
      alerts.push({
        alertType: 'missing_purchase_order',
        severity: 'medium',
        message: '50万円以上の案件には発注書または契約書が必要です',
      })
    }

    for (const po of purchaseOrders) {
      for (const inv of invoices) {
        if (po.amount != null && inv.amount != null) {
          const diff = Math.abs(po.amount - inv.amount)
          if (diff > 1) {
            alerts.push({
              alertType: 'amount_mismatch',
              severity: 'high',
              message: `発注書金額(${po.amount})と請求書金額(${inv.amount})に差異があります（差額: ${diff}円）`,
              field1: `PO: ${po.id}`,
              field2: `INV: ${inv.id}`,
            })
          }
        }
      }
    }

    for (const po of purchaseOrders) {
      for (const inv of invoices) {
        if (po.vendorName && inv.vendorName && po.vendorName !== inv.vendorName) {
          alerts.push({
            alertType: 'vendor_mismatch',
            severity: 'medium',
            message: `発注先(${po.vendorName})と請求元(${inv.vendorName})が異なります`,
            field1: `PO: ${po.id}`,
            field2: `INV: ${inv.id}`,
          })
        }
      }
    }

    for (const dn of deliveryNotes) {
      for (const inv of invoices) {
        if (dn.date && inv.date && dn.date > inv.date) {
          alerts.push({
            alertType: 'date_sequence_error',
            severity: 'high',
            message: '請求日が納品日より前です',
            field1: `Delivery: ${dn.date.toISOString().split('T')[0]}`,
            field2: `Invoice: ${inv.date.toISOString().split('T')[0]}`,
          })
        }
      }
    }

    if (deliveryNotes.length === 0 && invoices.length > 0) {
      alerts.push({
        alertType: 'missing_delivery_note',
        severity: 'medium',
        message: '請求書があるが納品書/検収書がありません',
      })
    }

    await prisma.procurementAlert.deleteMany({ where: { caseId } })

    if (alerts.length > 0) {
      await prisma.procurementAlert.createMany({
        data: alerts.map((alert) => ({
          caseId,
          alertType: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          field1: alert.field1,
          field2: alert.field2,
        })),
      })
    }

    return {
      caseId,
      isConsistent: alerts.length === 0,
      alerts,
    }
  }, 'DATABASE_ERROR')
}

export async function getProcurementCases(
  companyId: string,
  status?: string
): Promise<
  Result<
    Array<{
      id: string
      title: string
      vendor: string | null
      totalAmount: number
      status: string
      alertCount: number
    }>,
    AppError
  >
> {
  return tryCatch(async () => {
    const cases = await prisma.procurementCase.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
      },
      include: {
        _count: { select: { alerts: { where: { resolved: false } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return cases.map((c) => ({
      id: c.id,
      title: c.title,
      vendor: c.vendor,
      totalAmount: c.totalAmount,
      status: c.status,
      alertCount: c._count.alerts,
    }))
  }, 'DATABASE_ERROR')
}
