'use client'

import * as React from 'react'
import { GripVertical, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { FAQItem, Language } from '@/types/reports/ir-report'

export interface FAQManagerProps {
  faqs: FAQItem[]
  onChange: (faqs: FAQItem[]) => void
  language?: Language
  readOnly?: boolean
  title?: string
}

function generateId(): string {
  return `faq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export function FAQManager({
  faqs,
  onChange,
  language = 'ja',
  readOnly = false,
  title = 'FAQ管理',
}: FAQManagerProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)

  const handleAdd = () => {
    const newFAQ: FAQItem = {
      id: generateId(),
      question: { ja: '', en: '' },
      answer: { ja: '', en: '' },
      order: faqs.length,
    }
    onChange([...faqs, newFAQ])
    setExpandedId(newFAQ.id)
  }

  const handleUpdate = (id: string, updates: Partial<FAQItem>) => {
    onChange(faqs.map((faq) => (faq.id === id ? { ...faq, ...updates } : faq)))
  }

  const handleDelete = (id: string) => {
    const filtered = faqs.filter((faq) => faq.id !== id)
    onChange(filtered.map((faq, index) => ({ ...faq, order: index })))
    if (expandedId === id) {
      setExpandedId(null)
    }
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newFaqs = [...faqs]
    const temp = newFaqs[index - 1]
    newFaqs[index - 1] = newFaqs[index]
    newFaqs[index] = temp
    onChange(newFaqs.map((faq, i) => ({ ...faq, order: i })))
  }

  const handleMoveDown = (index: number) => {
    if (index === faqs.length - 1) return
    const newFaqs = [...faqs]
    const temp = newFaqs[index + 1]
    newFaqs[index + 1] = newFaqs[index]
    newFaqs[index] = temp
    onChange(newFaqs.map((faq, i) => ({ ...faq, order: i })))
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newFaqs = [...faqs]
    const draggedItem = newFaqs[draggedIndex]
    newFaqs.splice(draggedIndex, 1)
    newFaqs.splice(index, 0, draggedItem)
    onChange(newFaqs.map((faq, i) => ({ ...faq, order: i })))
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const getLocalizedText = (obj: { ja: string; en: string }) => {
    if (language === 'bilingual') {
      return obj.ja || obj.en
    }
    return obj[language]
  }

  const sortedFaqs = [...faqs].sort((a, b) => a.order - b.order)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={handleAdd}>
              <Plus className="mr-1 h-4 w-4" />
              追加
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedFaqs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            {language === 'en' ? 'No FAQs' : 'FAQがありません'}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedFaqs.map((faq, index) => {
              const isExpanded = expandedId === faq.id
              const isDragging = draggedIndex === index

              return (
                <div
                  key={faq.id}
                  draggable={!readOnly}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-md border ${isDragging ? 'opacity-50' : ''}`}
                >
                  <div
                    className="flex cursor-pointer items-center gap-2 p-3 hover:bg-muted/50"
                    onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                  >
                    {!readOnly && (
                      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {getLocalizedText(faq.question) ||
                          `${language === 'en' ? 'Question' : '質問'} ${index + 1}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!readOnly && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveUp(index)
                            }}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveDown(index)
                            }}
                            disabled={index === sortedFaqs.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(faq.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && !readOnly && (
                    <div className="space-y-4 border-t p-4 pt-0">
                      <div>
                        <label className="text-sm font-medium">
                          {language === 'en' ? 'Question (EN)' : '質問（日本語）'}
                        </label>
                        <Input
                          value={faq.question.ja}
                          onChange={(e) =>
                            handleUpdate(faq.id, {
                              question: { ...faq.question, ja: e.target.value },
                            })
                          }
                          placeholder={language === 'en' ? 'Enter question' : '質問を入力'}
                          className="mt-1"
                        />
                      </div>
                      {language !== 'ja' && (
                        <div>
                          <label className="text-sm font-medium">
                            {language === 'en' ? 'Question (JA)' : '質問（英語）'}
                          </label>
                          <Input
                            value={faq.question.en}
                            onChange={(e) =>
                              handleUpdate(faq.id, {
                                question: { ...faq.question, en: e.target.value },
                              })
                            }
                            placeholder="Enter question in English"
                            className="mt-1"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium">
                          {language === 'en' ? 'Answer (EN)' : '回答（日本語）'}
                        </label>
                        <Textarea
                          value={faq.answer.ja}
                          onChange={(e) =>
                            handleUpdate(faq.id, {
                              answer: { ...faq.answer, ja: e.target.value },
                            })
                          }
                          placeholder={language === 'en' ? 'Enter answer' : '回答を入力'}
                          className="mt-1 min-h-[100px]"
                        />
                      </div>
                      {language !== 'ja' && (
                        <div>
                          <label className="text-sm font-medium">
                            {language === 'en' ? 'Answer (JA)' : '回答（英語）'}
                          </label>
                          <Textarea
                            value={faq.answer.en}
                            onChange={(e) =>
                              handleUpdate(faq.id, {
                                answer: { ...faq.answer, en: e.target.value },
                              })
                            }
                            placeholder="Enter answer in English"
                            className="mt-1 min-h-[100px]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {isExpanded && readOnly && (
                    <div className="border-t p-4 pt-0">
                      <p className="mb-2 text-sm text-muted-foreground">
                        {language === 'en' ? 'A:' : '回答:'}
                      </p>
                      <p className="text-sm">{getLocalizedText(faq.answer)}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default FAQManager
