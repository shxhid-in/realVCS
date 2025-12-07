"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { useToast } from "../../hooks/use-toast"
import { 
  Clock,
  Package,
  IndianRupee,
  Weight,
  MapPin,
  RefreshCw,
  Download,
  CheckCircle,
  Timer,
  XCircle
} from "lucide-react"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import type { Order } from "../../lib/types"
import { getItemPurchasePricesFromSheet } from "../../lib/sheets"
import { freshButchers } from "../../lib/butcherConfig"

interface OrdersAnalyticsProps {
  className?: string
  allOrders: Order[] // Shared orders data from parent
  onRefresh?: () => void // Parent refresh function
  isLoading?: boolean
}

export function OrdersAnalytics({ className, allOrders, onRefresh, isLoading: externalIsLoading }: OrdersAnalyticsProps) {
  const { toast } = useToast()
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [selectedButcher, setSelectedButcher] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [itemStats, setItemStats] = useState<Record<string, { totalWeight: number; totalRevenue: number; count: number }>>({})
  const [isCalculatingItemStats, setIsCalculatingItemStats] = useState(false)

  // Filter orders based on selected butcher and date range
  const filterOrders = useCallback(() => {
    let filtered = allOrders
    
    // Filter by butcher
    if (selectedButcher !== 'all') {
      filtered = filtered.filter(order => order.butcherId === selectedButcher)
    }
    
    // Filter by date range
    const now = new Date()
    let startDate: Date
    let endDate: Date
    
    switch (dateRange) {
      case 'daily':
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        break
      case 'weekly':
        startDate = startOfWeek(now)
        endDate = endOfWeek(now)
        break
      case 'monthly':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'custom':
        startDate = new Date(customDateRange.start)
        endDate = new Date(customDateRange.end)
        endDate.setHours(23, 59, 59, 999)
        break
      default:
        startDate = startOfDay(now)
        endDate = endOfDay(now)
    }
    
    filtered = filtered.filter(order => {
      const orderDate = new Date(order.orderTime)
      // Normalize dates to start of day for accurate comparison
      const orderDateStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate())
      const startDateStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      return orderDateStart >= startDateStart && orderDateStart <= endDateStart
    })
    
    // Remove duplicates based on order ID and butcher ID combination
    const uniqueOrders = filtered.reduce((acc, order) => {
      const uniqueKey = `${order.id}-${order.butcherId}`
      if (!acc.has(uniqueKey)) {
        acc.set(uniqueKey, order)
      }
      return acc
    }, new Map())
    
    // Convert back to array and sort by order time (newest first)
    const deduplicatedOrders = Array.from(uniqueOrders.values())
    deduplicatedOrders.sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime())
    
    setFilteredOrders(deduplicatedOrders)
  }, [allOrders, selectedButcher, dateRange, customDateRange])

  // Don't auto-fetch on mount - data loads only on refresh button click
  // useEffect(() => {
  //   fetchAllOrders()
  // }, [])

  // Filter orders when filters or shared data change
  useEffect(() => {
    filterOrders()
  }, [filterOrders])

  // Manual refresh - calls parent refresh function
  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true)
      await onRefresh()
      setIsRefreshing(false)
      toast({
        title: "Refreshed",
        description: "Orders data has been updated from sheets.",
      })
    }
  }

  // Use external loading state if provided
  const isLoadingState = externalIsLoading !== undefined ? externalIsLoading : false
  const isRefreshingState = isRefreshing

  // Export orders to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No orders to export.",
      })
      return
    }

    const headers = [
      'Order ID',
      'Butcher',
      'Customer',
      'Items',
      'Status',
      'Order Time',
      'Prep Time (min)',
      'Weight/Quantity',
      'Revenue (₹)',
      'Address'
    ]

    const csvData = filteredOrders.map((order, index) => [
      `${order.id.replace('ORD-', '')}-${order.butcherId}`,
      order.butcherName || freshButchers.find(b => b.id === order.butcherId)?.name,
      order.customerName,
      order.items.map(item => `${item.name} (${item.quantity}${item.unit})`).join('; '),
      order.status,
      format(new Date(order.orderTime), 'dd/MM/yyyy HH:mm'),
      order.completionTime || '',
      order.pickedWeight ? `${order.pickedWeight} kg` : '',
      order.revenue || '',
      order.address || ''
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `orders_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Complete",
      description: `Exported ${filteredOrders.length} orders to CSV.`,
    })
  }

  // Get status badge with color
  const getStatusBadge = (status: string, rejectionReason?: string) => {
    const statusConfig = {
      'new': { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'New' },
      'preparing': { color: 'bg-yellow-100 text-yellow-800', icon: Timer, label: 'Preparing' },
      'prepared': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Prepared' },
      'completed': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Completed' },
      'ready to pick up': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Ready to Pick Up' },
      'rejected': { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      'declined': { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Declined' }
    }
    
    const config = statusConfig[status.toLowerCase() as keyof typeof statusConfig] || statusConfig['new']
    const Icon = config.icon
    
    return (
      <Badge className={`${config.color} border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  // Get order row styling based on status
  const getOrderRowStyle = (status: string) => {
    const statusStyles = {
      'new': 'border-l-4 border-l-gray-400',
      'preparing': 'border-l-4 border-l-yellow-400',
      'prepared': 'border-l-4 border-l-blue-400',
      'completed': 'border-l-4 border-l-blue-400',
      'ready to pick up': 'border-l-4 border-l-blue-400',
      'rejected': 'border-l-4 border-l-red-400',
      'declined': 'border-l-4 border-l-red-400'
    }
    
    return statusStyles[status.toLowerCase() as keyof typeof statusStyles] || statusStyles['new']
  }

  // Calculate summary statistics
  const getSummaryStats = () => {
    const total = filteredOrders.length
    const completed = filteredOrders.filter(o => ['completed', 'prepared', 'ready to pick up'].includes(o.status.toLowerCase())).length
    const rejected = filteredOrders.filter(o => ['rejected', 'declined'].includes(o.status.toLowerCase())).length
    const preparing = filteredOrders.filter(o => o.status.toLowerCase() === 'preparing').length
    const newOrders = filteredOrders.filter(o => o.status.toLowerCase() === 'new').length
    const totalRevenue = filteredOrders
      .filter(o => ['completed', 'prepared', 'ready to pick up'].includes(o.status.toLowerCase()))
      .reduce((sum, order) => sum + (order.revenue || 0), 0)
    
    return { total, completed, rejected, preparing, newOrders, totalRevenue }
  }

  const stats = getSummaryStats()

  // Get purchase price for a single item
  const getPurchasePriceFromMenu = async (butcherId: string, itemName: string, size: string = 'default'): Promise<number> => {
    try {
      // Import the actual getPurchasePriceFromMenu from sheets.ts which now returns { price, category }
      const { getPurchasePriceFromMenu: getPriceFromMenu } = await import('@/lib/sheets');
      const { price } = await getPriceFromMenu(butcherId, itemName, size);
      return price;
    } catch (error) {
      return 0;
    }
  };

  // Calculate revenue based on actual purchase prices from menu
  const calculateOrderRevenue = async (order: Order): Promise<number> => {
    
    // Use stored revenue if available
    if (order.revenue) {
      return order.revenue;
    }
    
    // Use item revenues if available (sum of all item revenues)
    if (order.itemRevenues) {
      const itemRevenueSum = Object.values(order.itemRevenues).reduce((sum, revenue) => sum + revenue, 0);
      return itemRevenueSum;
    }
    
    
    // Calculate revenue using actual purchase prices from menu
    let totalRevenue = 0;
    const orderWeight = order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0);
    
    for (const item of order.items) {
      try {
        // Get size from order item, default to 'default' if not present
        const itemSize = item.size || 'default';
        // Get purchase price from menu (pass size parameter)
        const purchasePrice = await getPurchasePriceFromMenu(order.butcherId || 'usaj', item.name, itemSize);
        
        if (purchasePrice > 0) {
          // Distribute weight proportionally based on item quantity
          const totalItemQuantity = order.items.reduce((sum, i) => sum + i.quantity, 0);
          const itemProportion = totalItemQuantity > 0 ? item.quantity / totalItemQuantity : 0;
          const itemWeight = orderWeight * itemProportion;
          const itemRevenue = itemWeight * purchasePrice;
          
          totalRevenue += itemRevenue;
        } else {
        }
      } catch (error) {
      }
    }
    
    return totalRevenue;
  };

  // Calculate item-wise statistics for today only
  const todayCompletedOrders = useMemo(() => {
    return filteredOrders.filter(order => {
      const orderDate = new Date(order.orderTime);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString() && 
             ['completed', 'prepared', 'ready to pick up'].includes(order.status.toLowerCase());
    });
  }, [filteredOrders]); // Only recalculate when filteredOrders changes


  // Calculate item stats when orders change - using useEffect with proper dependency management
  useEffect(() => {
    const runCalculation = async () => {
      if (todayCompletedOrders.length === 0) {
        setItemStats({});
        return;
      }

      // Prevent unnecessary calculations if already calculating
      if (isCalculatingItemStats) {
        return;
      }

      setIsCalculatingItemStats(true);
      try {
        const stats: Record<string, { totalWeight: number; totalRevenue: number; count: number }> = {};

        for (const order of todayCompletedOrders) {
          const orderRevenue = await calculateOrderRevenue(order);
          const orderWeight = order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0);
          
          order.items.forEach((item) => {
            if (!stats[item.name]) {
              stats[item.name] = { totalWeight: 0, totalRevenue: 0, count: 0 };
            }
            
            // Distribute weight and revenue proportionally based on item quantity
            const totalItemQuantity = order.items.reduce((sum, i) => sum + i.quantity, 0);
            const itemProportion = totalItemQuantity > 0 ? item.quantity / totalItemQuantity : 0;
            const itemWeight = orderWeight * itemProportion;
            const itemRevenue = orderRevenue * itemProportion;
            
            stats[item.name].totalWeight += itemWeight;
            stats[item.name].totalRevenue += itemRevenue;
            stats[item.name].count += 1;
          });
        }

        setItemStats(stats);
      } catch (error) {
      } finally {
        setIsCalculatingItemStats(false);
      }
    };

    runCalculation();
  }, [todayCompletedOrders]); // Use direct dependency

  // Sort items by revenue (highest first)
  const sortedItemStats = Object.entries(itemStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  if (isLoadingState) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading orders data...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className ? `space-y-6 ${className}` : 'space-y-6'}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Package className="h-5 w-5 flex-shrink-0" />
                Orders Analytics
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                Track all orders processed by all butchers with detailed analytics
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button onClick={handleExportCSV} variant="outline" size="sm" disabled={filteredOrders.length === 0} className="text-xs sm:text-sm">
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Button onClick={handleRefresh} disabled={isRefreshingState} variant="outline" size="sm" className="text-xs sm:text-sm">
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isRefreshingState ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefreshingState ? 'Refreshing...' : 'Refresh'}</span>
                <span className="sm:hidden">{isRefreshingState ? 'Refreshing' : 'Refresh'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Butcher</Label>
              <Select value={selectedButcher} onValueChange={setSelectedButcher}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Butchers</SelectItem>
                  {freshButchers.map(butcher => (
                    <SelectItem key={butcher.id} value={butcher.id}>
                      {butcher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {selectedButcher === 'all' ? 'All butchers' : freshButchers.find(b => b.id === selectedButcher)?.name}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preparing</CardTitle>
            <Timer className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.preparing}</div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.newOrders}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.rejected / stats.total) * 100).toFixed(1) : 0}% rejection rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground">
              From completed orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Item-wise Sales Today */}
      {isCalculatingItemStats ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Item-wise Sales Today
            </CardTitle>
            <CardDescription>
              Calculating item sales data...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading item statistics...
            </div>
          </CardContent>
        </Card>
      ) : sortedItemStats.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Item-wise Sales Today
            </CardTitle>
            <CardDescription>
              Breakdown of items sold today across all butchers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedItemStats.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.count} order{item.count !== 1 ? 's' : ''} • {item.totalWeight.toFixed(2)} kg
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      ₹{item.totalRevenue.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders Details</CardTitle>
          <CardDescription>
            Showing {filteredOrders.length} orders
            {selectedButcher !== 'all' && ` for ${freshButchers.find(b => b.id === selectedButcher)?.name}`}
            {dateRange === 'daily' && ' from today'}
            {dateRange === 'weekly' && ' from this week'}
            {dateRange === 'monthly' && ' from this month'}
            {dateRange === 'custom' && ` from ${customDateRange.start} to ${customDateRange.end}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No orders found for the selected criteria</p>
            </div>
          ) : (
            <>
              {/* ✅ FIX: Scrollable table for all screen sizes */}
              <div className="w-full overflow-x-auto scrollbar-hide">
                <div className="min-w-[800px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Butcher</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Order Time</TableHead>
                      <TableHead>Prep Time</TableHead>
                      <TableHead>Weight/Quantity</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order, index) => (
                      <TableRow key={`${order.id}-${order.butcherId}-${index}`} className={getOrderRowStyle(order.status)}>
                        <TableCell className="font-medium">
                          {order.id.replace('ORD-', '')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {order.butcherName || freshButchers.find(b => b.id === order.butcherId)?.name}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            {order.items.map((item, index) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium">{item.name}</span>
                                <span className="text-muted-foreground ml-1">
                                  ({item.quantity}{item.unit})
                                </span>
                                {item.size && (
                                  <span className="text-primary ml-1 font-medium">
                                    - Size: {item.size}
                                  </span>
                                )}
                                {item.cutType && (
                                  <span className="text-muted-foreground ml-1">
                                    - {item.cutType}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.status, order.rejectionReason)}
                          {order.rejectionReason && (
                            <div className="text-xs text-red-600 mt-1">
                              {order.rejectionReason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(order.orderTime), 'dd/MM/yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(order.orderTime), 'HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.completionTime ? (
                            <div className="text-sm">
                              {order.completionTime} min
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.pickedWeight ? (
                            <div className="text-sm">
                              <Weight className="h-3 w-3 inline mr-1" />
                              {order.pickedWeight} kg
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.revenue ? (
                            <div className="text-sm font-medium text-green-600">
                              <IndianRupee className="h-3 w-3 inline mr-1" />
                              {order.revenue.toLocaleString('en-IN')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.address ? (
                            <div className="max-w-xs text-sm">
                              <MapPin className="h-3 w-3 inline mr-1" />
                              {order.address}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {filteredOrders.map((order, index) => (
                  <Card key={`${order.id}-${order.butcherId}-${index}`} className={`${getOrderRowStyle(order.status)}`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">Order #{order.id.replace('ORD-', '')}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              {order.butcherName || freshButchers.find(b => b.id === order.butcherId)?.name}
                            </Badge>
                            <span>•</span>
                            <span>{order.customerName}</span>
                          </CardDescription>
                        </div>
                        {getStatusBadge(order.status, order.rejectionReason)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Items */}
                      <div>
                        <h4 className="font-medium text-sm mb-2">Items:</h4>
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={index} className="text-sm">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-muted-foreground ml-1">
                                ({item.quantity}{item.unit})
                              </span>
                              {item.size && (
                                <span className="text-primary ml-1 font-medium">
                                  - Size: {item.size}
                                </span>
                              )}
                              {item.cutType && (
                                <span className="text-muted-foreground ml-1">
                                  - {item.cutType}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Order Time:</span>
                          <div className="font-medium">
                            {format(new Date(order.orderTime), 'dd/MM/yyyy HH:mm')}
                          </div>
                        </div>
                        {order.completionTime && (
                          <div>
                            <span className="text-muted-foreground">Prep Time:</span>
                            <div className="font-medium">{order.completionTime} min</div>
                          </div>
                        )}
                        {order.pickedWeight && (
                          <div>
                            <span className="text-muted-foreground">Weight:</span>
                            <div className="font-medium flex items-center">
                              <Weight className="h-3 w-3 mr-1" />
                              {order.pickedWeight} kg
                            </div>
                          </div>
                        )}
                        {order.revenue && (
                          <div>
                            <span className="text-muted-foreground">Revenue:</span>
                            <div className="font-medium text-green-600 flex items-center">
                              <IndianRupee className="h-3 w-3 mr-1" />
                              {order.revenue.toLocaleString('en-IN')}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Address */}
                      {order.address && (
                        <div>
                          <span className="text-muted-foreground text-sm">Address:</span>
                          <div className="text-sm flex items-start">
                            <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                            {order.address}
                          </div>
                        </div>
                      )}

                      {/* Rejection Reason */}
                      {order.rejectionReason && (
                        <div>
                          <span className="text-muted-foreground text-sm">Reason:</span>
                          <div className="text-sm text-red-600">
                            {order.rejectionReason}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}