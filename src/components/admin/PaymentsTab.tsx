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
import { PaymentLinkModal } from "./PaymentLinkModal"
import { CreatePaymentLinkModal } from "./CreatePaymentLinkModal"

interface PaymentsTabProps {
  selectedDate: string
  onRefresh: () => void
}

export interface PaymentsTabRef {
  refresh: () => void
}

interface PaymentWithLink {
  payment: ZohoPayment
  paymentLinkStatus?: 'active' | 'paid' | 'expired' | 'cancelled'
  paymentLinkId?: string
}

type PaymentSortOption = 'date-desc' | 'date-asc' | 'status-asc' | 'status-desc' | 'amount-desc' | 'amount-asc'

const paymentsCache = new Map<string, { data: PaymentWithLink[]; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000

export const PaymentsTab = React.forwardRef<PaymentsTabRef, PaymentsTabProps>(
  ({ selectedDate, onRefresh }, ref) => {
  const { toast } = useToast()
  const [payments, setPayments] = useState<PaymentWithLink[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithLink | null>(null)
  const [isPaymentLinkModalOpen, setIsPaymentLinkModalOpen] = useState(false)
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
      if (!response.ok) {
        throw new Error('Failed to fetch payments')
      }
      const { payments: fetchedPayments } = await response.json()
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[PaymentsTab] Fetched payments:', {
          count: fetchedPayments?.length || 0,
          sample: fetchedPayments?.[0],
          selectedDate
        });
      }
      
      const paymentsWithLinks: PaymentWithLink[] = (fetchedPayments || []).map((payment: ZohoPayment) => ({
        payment,
        paymentLinkStatus: payment.status === 'succeeded' ? 'paid' : 'active' as const,
      }))
      
      paymentsCache.set(selectedDate, {
        data: paymentsWithLinks,
        timestamp: Date.now()
      })
      
      setPayments(paymentsWithLinks)
      setHasFetched(true)
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[PaymentsTab] Processed payments:', {
          count: paymentsWithLinks.length,
          payments: paymentsWithLinks
        });
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch payments",
      })
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

  const handlePaymentClick = (paymentWithLink: PaymentWithLink) => {
    setSelectedPayment(paymentWithLink)
    setIsPaymentLinkModalOpen(true)
  }

  const getPaymentMethodIcon = (method: string | undefined | null | number) => {
    if (!method) return <CreditCard className="h-4 w-4" />
    // Ensure method is a string
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

  const getPaymentLinkStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">N/A</Badge>
    
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'active': { label: 'Active', variant: 'default' },
      'paid': { label: 'Paid', variant: 'default' },
      'expired': { label: 'Expired', variant: 'secondary' },
      'cancelled': { label: 'Cancelled', variant: 'destructive' },
    }
    
    const statusInfo = statusMap[status.toLowerCase()] || { label: status, variant: 'outline' as const }
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    )
  }

  const sortPayments = (paymentsToSort: PaymentWithLink[], sortOption: PaymentSortOption): PaymentWithLink[] => {
    const sorted = [...paymentsToSort]
    
    switch (sortOption) {
      case 'date-desc':
        return sorted.sort((a, b) => {
          const dateA = typeof a.payment.date === 'number' 
            ? (a.payment.date < 10000000000 ? a.payment.date * 1000 : a.payment.date)
            : new Date(a.payment.date).getTime()
          const dateB = typeof b.payment.date === 'number'
            ? (b.payment.date < 10000000000 ? b.payment.date * 1000 : b.payment.date)
            : new Date(b.payment.date).getTime()
          return dateB - dateA // Newest first
        })
      case 'date-asc':
        return sorted.sort((a, b) => {
          const dateA = typeof a.payment.date === 'number'
            ? (a.payment.date < 10000000000 ? a.payment.date * 1000 : a.payment.date)
            : new Date(a.payment.date).getTime()
          const dateB = typeof b.payment.date === 'number'
            ? (b.payment.date < 10000000000 ? b.payment.date * 1000 : b.payment.date)
            : new Date(b.payment.date).getTime()
          return dateA - dateB // Oldest first
        })
      case 'status-asc':
        return sorted.sort((a, b) => {
          // Sort by payment link status (what's displayed in Link Status column)
          const statusA = (a.paymentLinkStatus || 'N/A').toLowerCase()
          const statusB = (b.paymentLinkStatus || 'N/A').toLowerCase()
          return statusA.localeCompare(statusB)
        })
      case 'status-desc':
        return sorted.sort((a, b) => {
          // Sort by payment link status (what's displayed in Link Status column)
          const statusA = (a.paymentLinkStatus || 'N/A').toLowerCase()
          const statusB = (b.paymentLinkStatus || 'N/A').toLowerCase()
          return statusB.localeCompare(statusA)
        })
      case 'amount-desc':
        return sorted.sort((a, b) => b.payment.amount - a.payment.amount) // High to low
      case 'amount-asc':
        return sorted.sort((a, b) => a.payment.amount - b.payment.amount) // Low to high
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
              <SelectItem value="status-asc">Link Status (A-Z)</SelectItem>
              <SelectItem value="status-desc">Link Status (Z-A)</SelectItem>
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
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Link Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No payments found for selected date
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPayments.map((paymentWithLink) => {
                    const { payment } = paymentWithLink
                    
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
                    
                    // Debug log in development
                    if (process.env.NODE_ENV === 'development' && typeof paymentMethodRaw === 'object') {
                      console.log('[PaymentsTab] Payment method is object:', {
                        payment_id: payment.payment_id,
                        paymentMethodRaw,
                        extracted: paymentMethod
                      })
                    }
                    
                    return (
                      <TableRow 
                        key={payment.payment_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handlePaymentClick(paymentWithLink)}
                      >
                        <TableCell>{paymentDate}</TableCell>
                        <TableCell className="text-right font-medium">
                          <IndianRupee className="h-4 w-4 inline mr-1" />
                          {payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(paymentMethod)}
                            <span className="text-sm">{paymentMethod}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getPaymentLinkStatusBadge(paymentWithLink.paymentLinkStatus)}
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

      {selectedPayment && (
        <PaymentLinkModal
          payment={selectedPayment.payment}
          paymentLinkId={selectedPayment.paymentLinkId}
          isOpen={isPaymentLinkModalOpen}
          onClose={() => {
            setIsPaymentLinkModalOpen(false)
            setSelectedPayment(null)
          }}
          onUpdate={() => {
            fetchPayments()
            setIsPaymentLinkModalOpen(false)
          }}
        />
      )}

      {isCreateModalOpen && (
        <CreatePaymentLinkModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            fetchPayments()
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
})

PaymentsTab.displayName = 'PaymentsTab'

