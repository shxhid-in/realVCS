"use client"

import React, { useState, useRef } from "react"
import { Card, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { 
  Calendar, 
  RefreshCw,
  FileText,
  CreditCard
} from "lucide-react"
import { format } from "date-fns"
import { InvoicesTab } from "./InvoicesTab"
import { PaymentsTab } from "./PaymentsTab"

export function OrdersTab() {
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices')
  const [refreshKey, setRefreshKey] = useState(0)
  const invoicesTabRef = useRef<{ refresh: () => void }>(null)
  const paymentsTabRef = useRef<{ refresh: () => void }>(null)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    // Trigger refresh in child components
    setTimeout(() => {
      invoicesTabRef.current?.refresh()
      paymentsTabRef.current?.refresh()
    }, 0)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Date Filter */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg sm:text-xl">Orders</CardTitle>
              <CardDescription className="text-sm mt-1">
                View and manage invoices and payments from Zoho
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="space-y-2">
                <Label htmlFor="order-date" className="text-sm">Select Date</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="order-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
              </div>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs for Invoices and Payments */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'invoices' | 'payments')} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <InvoicesTab ref={invoicesTabRef} key={`invoices-${selectedDate}-${refreshKey}`} selectedDate={selectedDate} onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentsTab ref={paymentsTabRef} key={`payments-${selectedDate}-${refreshKey}`} selectedDate={selectedDate} onRefresh={handleRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

