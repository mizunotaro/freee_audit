'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  Edit,
  Loader2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { toast } from 'sonner'

interface PeerCompany {
  id: string
  ticker: string | null
  name: string
  nameEn: string | null
  exchange: string | null
  industry: string | null
  marketCap: number | null
  revenue: number | null
  employees: number | null
  per: number | null
  pbr: number | null
  evEbitda: number | null
  psr: number | null
  beta: number | null
  similarityScore: number | null
  dataSource: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface PeerCandidate {
  ticker?: string
  name: string
  industry: string
  similarityScore: number
  keyMetrics: {
    per?: number
    pbr?: number
    evEbitda?: number
  }
  matchReasons: string[]
}

export default function PeerCompaniesSettingsPage() {
  const [peers, setPeers] = useState<PeerCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSuggestDialogOpen, setIsSuggestDialogOpen] = useState(false)
  const [editingPeer, setEditingPeer] = useState<PeerCompany | null>(null)
  const [suggestedPeers, setSuggestedPeers] = useState<PeerCandidate[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)

  const [formData, setFormData] = useState({
    ticker: '',
    name: '',
    nameEn: '',
    exchange: '',
    industry: '',
    marketCap: '',
    revenue: '',
    employees: '',
    per: '',
    pbr: '',
    evEbitda: '',
    psr: '',
    beta: '',
    similarityScore: '',
  })

  const [suggestForm, setSuggestForm] = useState({
    industry: '',
    revenue: '',
    employees: '',
    minPeers: 5,
    maxPeers: 10,
  })

  const fetchPeers = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/peer-companies')
      const data = await response.json()
      if (data.success) {
        setPeers(data.data)
      }
    } catch {
      toast.error('Failed to fetch peer companies')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPeers()
  }, [fetchPeers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingPeer
        ? `/api/settings/peer-companies/${editingPeer.id}`
        : '/api/settings/peer-companies'
      const method = editingPeer ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: formData.ticker || null,
          name: formData.name,
          nameEn: formData.nameEn || null,
          exchange: formData.exchange || null,
          industry: formData.industry || null,
          marketCap: formData.marketCap ? parseFloat(formData.marketCap) : null,
          revenue: formData.revenue ? parseFloat(formData.revenue) : null,
          employees: formData.employees ? parseInt(formData.employees) : null,
          per: formData.per ? parseFloat(formData.per) : null,
          pbr: formData.pbr ? parseFloat(formData.pbr) : null,
          evEbitda: formData.evEbitda ? parseFloat(formData.evEbitda) : null,
          psr: formData.psr ? parseFloat(formData.psr) : null,
          beta: formData.beta ? parseFloat(formData.beta) : null,
          similarityScore: formData.similarityScore ? parseFloat(formData.similarityScore) : null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(editingPeer ? 'Peer company updated' : 'Peer company added')
        setIsDialogOpen(false)
        resetForm()
        fetchPeers()
      } else {
        toast.error(data.error || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save peer company')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this peer company?')) return

    try {
      const response = await fetch(`/api/settings/peer-companies/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Peer company deleted')
        fetchPeers()
      } else {
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Failed to delete peer company')
    }
  }

  const handleToggleActive = async (peer: PeerCompany) => {
    try {
      const response = await fetch(`/api/settings/peer-companies/${peer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !peer.isActive }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(peer.isActive ? 'Peer company deactivated' : 'Peer company activated')
        fetchPeers()
      }
    } catch {
      toast.error('Failed to update peer company')
    }
  }

  const handleSuggestPeers = async () => {
    if (!suggestForm.industry) {
      toast.error('Industry is required')
      return
    }

    setIsSuggesting(true)
    try {
      const response = await fetch('/api/settings/peer-companies/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: suggestForm.industry,
          revenue: suggestForm.revenue ? parseFloat(suggestForm.revenue) : undefined,
          employees: suggestForm.employees ? parseInt(suggestForm.employees) : undefined,
          minPeers: suggestForm.minPeers,
          maxPeers: suggestForm.maxPeers,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setSuggestedPeers(data.data)
        toast.success(`Found ${data.data.length} suggested peer companies`)
      } else {
        toast.error(data.error || 'Failed to suggest peers')
      }
    } catch {
      toast.error('Failed to suggest peers')
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleAddSuggested = async (candidate: PeerCandidate) => {
    try {
      const response = await fetch('/api/settings/peer-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: candidate.ticker || null,
          name: candidate.name,
          industry: candidate.industry,
          per: candidate.keyMetrics.per,
          pbr: candidate.keyMetrics.pbr,
          evEbitda: candidate.keyMetrics.evEbitda,
          similarityScore: candidate.similarityScore,
          dataSource: 'ai_suggested',
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`Added ${candidate.name}`)
        setSuggestedPeers((prev) => prev.filter((p) => p.name !== candidate.name))
        fetchPeers()
      } else {
        toast.error(data.error || 'Failed to add peer')
      }
    } catch {
      toast.error('Failed to add peer company')
    }
  }

  const resetForm = () => {
    setFormData({
      ticker: '',
      name: '',
      nameEn: '',
      exchange: '',
      industry: '',
      marketCap: '',
      revenue: '',
      employees: '',
      per: '',
      pbr: '',
      evEbitda: '',
      psr: '',
      beta: '',
      similarityScore: '',
    })
    setEditingPeer(null)
  }

  const openEditDialog = (peer: PeerCompany) => {
    setEditingPeer(peer)
    setFormData({
      ticker: peer.ticker || '',
      name: peer.name,
      nameEn: peer.nameEn || '',
      exchange: peer.exchange || '',
      industry: peer.industry || '',
      marketCap: peer.marketCap?.toString() || '',
      revenue: peer.revenue?.toString() || '',
      employees: peer.employees?.toString() || '',
      per: peer.per?.toString() || '',
      pbr: peer.pbr?.toString() || '',
      evEbitda: peer.evEbitda?.toString() || '',
      psr: peer.psr?.toString() || '',
      beta: peer.beta?.toString() || '',
      similarityScore: peer.similarityScore?.toString() || '',
    })
    setIsDialogOpen(true)
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-'
    if (value >= 1000000000) return `¥${(value / 1000000000).toFixed(1)}B`
    if (value >= 1000000) return `¥${(value / 1000000).toFixed(1)}M`
    return `¥${value.toLocaleString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Peer Companies</h1>
          <p className="text-muted-foreground">
            Manage comparable companies for valuation analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsSuggestDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            AI Suggest
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Peer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Peer Company List</CardTitle>
          <CardDescription>
            {peers.filter((p) => p.isActive).length} active peer companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : peers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No peer companies added yet. Use AI Suggest or add manually.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right">Market Cap</TableHead>
                  <TableHead className="text-right">P/E</TableHead>
                  <TableHead className="text-right">P/B</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peers.map((peer) => (
                  <TableRow key={peer.id} className={!peer.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-mono">{peer.ticker || '-'}</TableCell>
                    <TableCell className="font-medium">{peer.name}</TableCell>
                    <TableCell>{peer.industry || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(peer.marketCap)}</TableCell>
                    <TableCell className="text-right">{peer.per?.toFixed(1) ?? '-'}</TableCell>
                    <TableCell className="text-right">{peer.pbr?.toFixed(2) ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      {peer.similarityScore ? `${(peer.similarityScore * 100).toFixed(0)}%` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={peer.isActive ? 'default' : 'secondary'}>
                        {peer.dataSource}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(peer)}
                          title={peer.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {peer.isActive ? (
                            <ToggleRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(peer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(peer.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPeer ? 'Edit Peer Company' : 'Add Peer Company'}</DialogTitle>
            <DialogDescription>
              Enter the details of the comparable company
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticker">Ticker</Label>
                  <Input
                    id="ticker"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    placeholder="e.g., 7203"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nameEn">Name (English)</Label>
                  <Input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exchange">Exchange</Label>
                  <Input
                    id="exchange"
                    value={formData.exchange}
                    onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                    placeholder="e.g., TSE"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marketCap">Market Cap (JPY)</Label>
                  <Input
                    id="marketCap"
                    type="number"
                    value={formData.marketCap}
                    onChange={(e) => setFormData({ ...formData, marketCap: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="per">P/E Ratio</Label>
                  <Input
                    id="per"
                    type="number"
                    step="0.1"
                    value={formData.per}
                    onChange={(e) => setFormData({ ...formData, per: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pbr">P/B Ratio</Label>
                  <Input
                    id="pbr"
                    type="number"
                    step="0.01"
                    value={formData.pbr}
                    onChange={(e) => setFormData({ ...formData, pbr: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evEbitda">EV/EBITDA</Label>
                  <Input
                    id="evEbitda"
                    type="number"
                    step="0.1"
                    value={formData.evEbitda}
                    onChange={(e) => setFormData({ ...formData, evEbitda: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="similarityScore">Similarity</Label>
                  <Input
                    id="similarityScore"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.similarityScore}
                    onChange={(e) => setFormData({ ...formData, similarityScore: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingPeer ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuggestDialogOpen} onOpenChange={setIsSuggestDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>AI Suggest Peer Companies</DialogTitle>
            <DialogDescription>
              Enter your company details to get AI-suggested peer companies
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="suggest-industry">Industry *</Label>
                <Input
                  id="suggest-industry"
                  value={suggestForm.industry}
                  onChange={(e) => setSuggestForm({ ...suggestForm, industry: e.target.value })}
                  placeholder="e.g., Software, Manufacturing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suggest-revenue">Revenue (JPY)</Label>
                <Input
                  id="suggest-revenue"
                  type="number"
                  value={suggestForm.revenue}
                  onChange={(e) => setSuggestForm({ ...suggestForm, revenue: e.target.value })}
                  placeholder="Annual revenue"
                />
              </div>
            </div>
            <Button onClick={handleSuggestPeers} disabled={isSuggesting}>
              {isSuggesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suggesting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Suggest Peers
                </>
              )}
            </Button>

            {suggestedPeers.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium">Suggested Peer Companies</h4>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {suggestedPeers.map((candidate, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="font-medium">
                          {candidate.ticker && (
                            <span className="mr-2 font-mono text-sm text-muted-foreground">
                              {candidate.ticker}
                            </span>
                          )}
                          {candidate.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {candidate.industry} • Score: {(candidate.similarityScore * 100).toFixed(0)}%
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {candidate.matchReasons.map((reason, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleAddSuggested(candidate)}>
                        <Plus className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSuggestDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
