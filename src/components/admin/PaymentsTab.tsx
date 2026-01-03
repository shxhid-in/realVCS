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
  RefreshCw,
  CreditCard,
  Smartphone
} from "lucide-react"
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Label } from "../ui/label"
import type { ZohoPayment } from "../../lib/zohoService"
import { CreatePaymentLinkModal } from "./CreatePaymentLinkModal"

interface PaymentsTabProps {
  selectedDate: string
  onRefresh: () => void
}

export interface PaymentsTabRef {
  refresh: () => void
}

type PaymentSortOption = 'date-desc' | 'date-asc' | 'status-asc' | 'status-desc' | 'amount-desc' | 'amount-asc'

const paymentsCache = new Map<string, { data: ZohoPayment[]; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000

export const PaymentsTab = React.forwardRef<PaymentsTabRef, PaymentsTabProps>(
  ({ selectedDate, onRefresh }, ref) => {
  const { toast } = useToast()
  const [payments, setPayments] = useState<ZohoPayment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<PaymentSortOption>('date-desc')
  const [hasFetched, setHasFetched] = useState(false)

  const fetchPayments = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = paymentsCache.get(selectedDate)
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setPayments(cached.data)
        setHasFetched(true)
        return
      }
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/zoho/payments?date=${selectedDate}`)
      const data = await response.json()
      
      // Handle 429 rate limit specifically
      if (response.status === 429) {
        const retryAfter = data.retryAfter || 5
        throw new Error(`Rate limit exceeded (429). Please try again in ${retryAfter} seconds.`)
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch payments')
      }
      
      const { payments: fetchedPayments } = data
      
      paymentsCache.set(selectedDate, {
        data: fetchedPayments || [],
        timestamp: Date.now()
      })
      
      setPayments(fetchedPayments || [])
      setHasFetched(true)
    } catch (error) {
      console.error('Error fetching payments:', error)
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch payments"
      
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
          description: `Too many API requests. Please wait ${retryAfter} seconds and try again.`,
        })
        
        // Auto-retry after delay
        if (!forceRefresh) {
          setTimeout(() => {
            fetchPayments(false)
          }, 5000)
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
      fetchPayments(false)
    }
  }, [selectedDate, hasFetched, fetchPayments])

  // Expose refresh function to parent
  React.useImperativeHandle(ref, () => ({
    refresh: () => {
      setHasFetched(false)
      fetchPayments(true)
    }
  }))

  const getPaymentMethodIcon = (method: string | undefined | null | number) => {
    if (!method) return <CreditCard className="h-4 w-4" />
    const methodStr = String(method)
    const methodLower = methodStr.toLowerCase()
    if (methodLower.includes('upi') || methodLower.includes('phonepe') || methodLower.includes('gpay')) {
      return <Smartphone className="h-4 w-4" />
    }
    return <CreditCard className="h-4 w-4" />
  }

  const getPaymentStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'succeeded': { label: 'Succeeded', variant: 'default' },
      'paid': { label: 'Paid', variant: 'default' },
      'failed': { label: 'Failed', variant: 'destructive' },
      'refunded': { label: 'Refunded', variant: 'secondary' },
      'pending': { label: 'Pending', variant: 'outline' },
    }
    
    const statusInfo = statusMap[status.toLowerCase()] || { label: status, variant: 'outline' as const }
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    )
  }

  const sortPayments = (paymentsToSort: ZohoPayment[], sortOption: PaymentSortOption): ZohoPayment[] => {
    const sorted = [...paymentsToSort]
    
    switch (sortOption) {
      case 'date-desc':
        return sorted.sort((a, b) => {
          const dateA = typeof a.date === 'number' 
            ? (a.date < 10000000000 ? a.date * 1000 : a.date)
            : new Date(a.date).getTime()
          const dateB = typeof b.date === 'number'
            ? (b.date < 10000000000 ? b.date * 1000 : b.date)
            : new Date(b.date).getTime()
          return dateB - dateA
        })
      case 'date-asc':
        return sorted.sort((a, b) => {
          const dateA = typeof a.date === 'number'
            ? (a.date < 10000000000 ? a.date * 1000 : a.date)
            : new Date(a.date).getTime()
          const dateB = typeof b.date === 'number'
            ? (b.date < 10000000000 ? b.date * 1000 : b.date)
            : new Date(b.date).getTime()
          return dateA - dateB
        })
      case 'status-asc':
        return sorted.sort((a, b) => a.status.toLowerCase().localeCompare(b.status.toLowerCase()))
      case 'status-desc':
        return sorted.sort((a, b) => b.status.toLowerCase().localeCompare(a.status.toLowerCase()))
      case 'amount-desc':
        return sorted.sort((a, b) => {
          const amountA = typeof a.amount === 'string' ? parseFloat(a.amount) : a.amount
          const amountB = typeof b.amount === 'string' ? parseFloat(b.amount) : b.amount
          return amountB - amountA
        })
      case 'amount-asc':
        return sorted.sort((a, b) => {
          const amountA = typeof a.amount === 'string' ? parseFloat(a.amount) : a.amount
          const amountB = typeof b.amount === 'string' ? parseFloat(b.amount) : b.amount
          return amountA - amountB
        })
      default:
        return sorted
    }
  }

  const sortedPayments = React.useMemo(() => {
    return sortPayments(payments, sortBy)
  }, [payments, sortBy])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Label htmlFor="sort-payments" className="text-sm font-medium">Sort by:</Label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as PaymentSortOption)}>
            <SelectTrigger id="sort-payments" className="w-[200px]">
              <SelectValue placeholder="Sort payments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Date (Newest First)</SelectItem>
              <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
              <SelectItem value="status-asc">Status (A-Z)</SelectItem>
              <SelectItem value="status-desc">Status (Z-A)</SelectItem>
              <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
              <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Payment Link
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
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
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No payments found for selected date
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPayments.map((payment) => {
                    let paymentDate = 'N/A'
                    if (payment.date) {
                      try {
                        let dateObj: Date
                        if (typeof payment.date === 'number') {
                          dateObj = payment.date < 10000000000 
                            ? new Date(payment.date * 1000)
                            : new Date(payment.date)
                        } else if (typeof payment.date === 'string') {
                          if (/^\d+$/.test(payment.date)) {
                            const timestamp = parseInt(payment.date)
                            dateObj = timestamp < 10000000000 
                              ? new Date(timestamp * 1000)
                              : new Date(timestamp)
                          } else {
                            dateObj = new Date(payment.date)
                          }
                        } else {
                          dateObj = new Date(payment.date)
                        }
                        paymentDate = format(dateObj, 'MMM dd, yyyy HH:mm')
                      } catch (error) {
                        console.error('Error parsing payment date:', payment.date, error)
                        paymentDate = 'Invalid date'
                      }
                    }
                    
                    let paymentMethodRaw = (payment as any).payment_method || payment.payment_mode || (payment as any).method
                    
                    let paymentMethod = 'N/A'
                    if (paymentMethodRaw) {
                      if (typeof paymentMethodRaw === 'object') {
                        paymentMethod = paymentMethodRaw.name || 
                                       paymentMethodRaw.type || 
                                       paymentMethodRaw.method || 
                                       paymentMethodRaw.payment_method ||
                                       paymentMethodRaw.label ||
                                       JSON.stringify(paymentMethodRaw)
                      } else {
                        paymentMethod = String(paymentMethodRaw)
                      }
                    }
                    
                    return (
                      <TableRow key={payment.payment_id}>
                        <TableCell>{paymentDate}</TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">
                            {payment.phone 
                              ? `${payment.dialing_code || ''} ${payment.phone}`.trim()
                              : 'N/A'
                            }
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <IndianRupee className="h-4 w-4 inline mr-1" />
                          {(typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(paymentMethod)}
                            <span className="text-sm">{paymentMethod}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getPaymentStatusBadge(payment.status)}
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

      <CreatePaymentLinkModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchPayments(true)
          setIsCreateModalOpen(false)
        }}
      />
    </div>
  )
})

PaymentsTab.displayName = 'PaymentsTab'
