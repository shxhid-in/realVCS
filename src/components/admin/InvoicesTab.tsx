"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { useToast } from "../../hooks/use-toast"
import { 
  IndianRupee, 
  Plus,
  RefreshCw
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Label } from "../ui/label"
import type { ZohoInvoice } from "../../lib/zohoService"
import ZohoService from "../../lib/zohoService"
import { InvoiceModal } from "./InvoiceModal"
import { CreateInvoiceModal } from "./CreateInvoiceModal"

interface InvoicesTabProps {
  selectedDate: string
  onRefresh: () => void
}

export interface InvoicesTabRef {
  refresh: () => void
}

type SortOption = 'date-desc' | 'date-asc' | 'status-asc' | 'status-desc' | 'amount-desc' | 'amount-asc'

const invoicesCache = new Map<string, { data: ZohoInvoice[]; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000

export const InvoicesTab = React.forwardRef<InvoicesTabRef, InvoicesTabProps>(
  ({ selectedDate, onRefresh }, ref) => {
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<ZohoInvoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<ZohoInvoice | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [hasFetched, setHasFetched] = useState(false)

  const fetchInvoices = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = invoicesCache.get(selectedDate)
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setInvoices(cached.data)
        setHasFetched(true)
        return
      }
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/zoho/invoices?date=${selectedDate}`)
      const data = await response.json()
      
      // Handle 429 rate limit specifically
      if (response.status === 429) {
        const retryAfter = data.retryAfter || 5
        throw new Error(`Rate limit exceeded (429). Please try again in ${retryAfter} seconds.`)
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch invoices')
      }
      
      const { invoices: fetchedInvoices } = data
      
      invoicesCache.set(selectedDate, {
        data: fetchedInvoices || [],
        timestamp: Date.now()
      })
      
      setInvoices(fetchedInvoices || [])
      setHasFetched(true)
    } catch (error) {
      console.error('Error fetching invoices:', error)
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch invoices"
      
      // Check if it's a rate limit error (429)
      const isRateLimit = errorMessage.includes('429') || 
                         errorMessage.includes('rate limit') || 
                         errorMessage.includes('Rate limit exceeded') ||
                         errorMessage.includes('exceeded')
      
      if (isRateLimit) {
        // Try to extract retry after time
        const retryMatch = errorMessage.match(/try again in (\d+) seconds?/i)
        const retryAfter = retryMatch ? retryMatch[1] : 'a few'
        
        toast({
          variant: "destructive",
          title: "Rate Limit Exceeded",
          description: `Too many API requests. Please wait ${retryAfter} seconds and try again. The system will automatically retry.`,
        })
        
        // Auto-retry after delay (exponential backoff handled by server)
        if (!forceRefresh) {
          setTimeout(() => {
            fetchInvoices(false)
          }, 5000) // Retry after 5 seconds
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate, toast])

  // Fetch on initial load only
  React.useEffect(() => {
    if (!hasFetched) {
      fetchInvoices(false)
    }
  }, [selectedDate, hasFetched, fetchInvoices])

  // Expose refresh function to parent
  React.useImperativeHandle(ref, () => ({
    refresh: () => {
      setHasFetched(false)
      fetchInvoices(true)
    }
  }))

  const handleInvoiceClick = async (invoice: ZohoInvoice) => {
    try {
      const response = await fetch(`/api/zoho/invoices?invoice_id=${invoice.invoice_id}`)
      if (response.ok) {
        const { invoice: fullInvoice } = await response.json()
        setSelectedInvoice(fullInvoice)
        setIsEditModalOpen(true)
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error)
    }
  }

  const getInvoiceStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'draft': { label: 'Draft', variant: 'outline' },
      'sent': { label: 'Sent', variant: 'default' },
      'paid': { label: 'Paid', variant: 'default' },
      'overdue': { label: 'Overdue', variant: 'destructive' },
      'void': { label: 'Void', variant: 'secondary' },
    }
    
    const statusInfo = statusMap[status.toLowerCase()] || { label: status, variant: 'outline' as const }
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    )
  }

  const sortInvoices = (invoicesToSort: ZohoInvoice[], sortOption: SortOption): ZohoInvoice[] => {
    const sorted = [...invoicesToSort]
    
    switch (sortOption) {
      case 'date-desc':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.date).getTime()
          const dateB = new Date(b.date).getTime()
          return dateB - dateA // Newest first
        })
      case 'date-asc':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.date).getTime()
          const dateB = new Date(b.date).getTime()
          return dateA - dateB // Oldest first
        })
      case 'status-asc':
        return sorted.sort((a, b) => {
          // Sort by invoice status (what's displayed in Status column)
          const statusA = a.status.toLowerCase()
          const statusB = b.status.toLowerCase()
          return statusA.localeCompare(statusB)
        })
      case 'status-desc':
        return sorted.sort((a, b) => {
          // Sort by invoice status (what's displayed in Status column)
          const statusA = a.status.toLowerCase()
          const statusB = b.status.toLowerCase()
          return statusB.localeCompare(statusA)
        })
      case 'amount-desc':
        return sorted.sort((a, b) => b.total - a.total) // High to low
      case 'amount-asc':
        return sorted.sort((a, b) => a.total - b.total) // Low to high
      default:
        return sorted
    }
  }

  const sortedInvoices = React.useMemo(() => {
    return sortInvoices(invoices, sortBy)
  }, [invoices, sortBy])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Label htmlFor="sort-invoices" className="text-sm font-medium">Sort by:</Label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger id="sort-invoices" className="w-[200px]">
              <SelectValue placeholder="Sort invoices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Date (Newest First)</SelectItem>
              <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
              <SelectItem value="status-asc">Invoice Status (A-Z)</SelectItem>
              <SelectItem value="status-desc">Invoice Status (Z-A)</SelectItem>
              <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
              <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Reference No.</TableHead>
                  <TableHead>Customer Details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No invoices found for selected date
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedInvoices.map((invoice) => {
                    const customerPhone = ZohoService.getCustomerPhone(invoice)

                    return (
                      <TableRow 
                        key={invoice.invoice_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleInvoiceClick(invoice)}
                      >
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">
                            {invoice.reference_number || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{invoice.customer_name}</p>
                            {customerPhone && (
                              <p className="text-xs text-muted-foreground">{customerPhone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <IndianRupee className="h-4 w-4 inline mr-1" />
                          {invoice.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {getInvoiceStatusBadge(invoice.status)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedInvoice(null)
          }}
          onUpdate={() => {
            fetchInvoices()
            setIsEditModalOpen(false)
          }}
        />
      )}

      {isCreateModalOpen && (
        <CreateInvoiceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            fetchInvoices()
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
})

InvoicesTab.displayName = 'InvoicesTab'

