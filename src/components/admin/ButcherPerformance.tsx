"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { Skeleton } from "../ui/skeleton"
import { useToast } from "../../hooks/use-toast"
import { 
  ShoppingCart,
  IndianRupee,
  Weight,
  Timer,
  TrendingUp,
  RefreshCw,
  Users,
  BarChart3,
  PieChart,
  Clock,
  XCircle,
  CheckCircle,
  AlertCircle,
  DollarSign
} from "lucide-react"
import { format } from "date-fns"
import type { Order, OrderItem } from "../../lib/types"
import { freshButchers, extractEnglishName, getButcherType as getButcherTypeFromConfig } from "../../lib/butcherConfig"
import { getItemPurchasePricesFromSheet } from "../../lib/sheets"
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface ButcherPerformanceProps {
  allOrders: Order[]
  onRefresh: () => void
  isLoading: boolean
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300']

export function ButcherPerformance({ allOrders, onRefresh, isLoading }: ButcherPerformanceProps) {
  const { toast } = useToast()
  const [selectedButcher, setSelectedButcher] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'custom'>('all')
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })

  // Filter orders based on butcher and date
  const filteredOrders = useMemo(() => {
    let filtered = allOrders
    
    // Filter by butcher
    if (selectedButcher) {
      filtered = filtered.filter(order => order.butcherId === selectedButcher)
    }
    
    // Filter by date
    if (dateFilter === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.orderTime)
        orderDate.setHours(0, 0, 0, 0)
        return orderDate.getTime() === today.getTime()
      })
    } else if (dateFilter === 'custom') {
      const start = new Date(customDateRange.start)
      const end = new Date(customDateRange.end)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.orderTime)
        return orderDate >= start && orderDate <= end
      })
    }
    // 'all' filter shows all orders (no additional filtering)
    
    return filtered
  }, [allOrders, selectedButcher, dateFilter, customDateRange])

  // Helper: Parse weight string to kilograms
  const parseWeightToKg = useCallback((weightStr: string): number => {
    if (!weightStr) return 0
    const normalized = weightStr.toLowerCase().trim()
    if (normalized.includes('kg')) {
      return parseFloat(normalized.replace('kg', '')) || 0
    } else if (normalized.includes('g')) {
      return (parseFloat(normalized.replace('g', '')) || 0) / 1000
    }
    return parseFloat(normalized) || 0
  }, [])

  // Helper: Get item weight from order
  const getItemWeight = useCallback((order: Order, itemName: string): number => {
    const englishName = extractEnglishName(itemName)
    
    if (order.itemWeights && order.itemWeights[englishName]) {
      return parseWeightToKg(order.itemWeights[englishName])
    }
    if (order.itemQuantities && order.itemQuantities[englishName]) {
      return parseWeightToKg(order.itemQuantities[englishName])
    }
    
    // Fallback to item quantity
    const item = order.items.find(i => i.name === itemName)
    if (item) {
      return item.unit === 'kg' ? item.quantity : item.quantity / 1000
    }
    return 0
  }, [parseWeightToKg])

  // Helper: Get item revenue from order
  const getItemRevenue = useCallback((order: Order, itemName: string): number => {
    if (!order.itemRevenues) return 0
    
    const englishName = extractEnglishName(itemName)
    
    if (order.itemRevenues[englishName] !== undefined) {
      return order.itemRevenues[englishName]
    }
    
    if (order.itemRevenues[itemName] !== undefined) {
      return order.itemRevenues[itemName]
    }
    
    for (const [key, value] of Object.entries(order.itemRevenues)) {
      if (extractEnglishName(key) === englishName || key === englishName) {
        return value
      }
    }
    
    return 0
  }, [])

  // Calculate total kilograms
  const totalKilograms = useMemo(() => {
    let totalKg = 0
    
    filteredOrders.forEach(order => {
      if (order.itemWeights) {
        Object.values(order.itemWeights).forEach(weightStr => {
          totalKg += parseWeightToKg(weightStr)
        })
      }
      if (order.itemQuantities) {
        Object.values(order.itemQuantities).forEach(qtyStr => {
          totalKg += parseWeightToKg(qtyStr)
        })
      }
    })
    
    return totalKg
  }, [filteredOrders, parseWeightToKg])

  // Calculate total revenue
  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, order) => {
      if (order.itemRevenues) {
        return sum + Object.values(order.itemRevenues).reduce((revSum, rev) => revSum + rev, 0)
      }
      return sum + (order.revenue || 0)
    }, 0)
  }, [filteredOrders])

  // Calculate average order value
  const averageOrderValue = useMemo(() => {
    if (filteredOrders.length === 0) return 0
    return totalRevenue / filteredOrders.length
  }, [filteredOrders.length, totalRevenue])

  // Calculate completion time helper
  const calculateCompletionTime = useCallback((order: Order): number | null => {
    if (order.completionTime && typeof order.completionTime === 'number') {
      return order.completionTime
    }
    
    if (order.preparationStartTime && order.preparationEndTime) {
      const start = new Date(order.preparationStartTime)
      const end = new Date(order.preparationEndTime)
      const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
      return diffMinutes
    }
    
    return null
  }, [])

  // Calculate average completion time
  const averageCompletionTime = useMemo(() => {
    const completedOrders = filteredOrders.filter(order => 
      ['completed', 'prepared', 'ready to pick up'].includes(order.status)
    )
    
    if (completedOrders.length === 0) return null
    
    const completionTimes = completedOrders
      .map(calculateCompletionTime)
      .filter((time): time is number => time !== null)
    
    if (completionTimes.length === 0) return null
    
    const avg = completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
    return avg
  }, [filteredOrders, calculateCompletionTime])

  // Completion time trend data for chart
  const completionTimeTrendData = useMemo(() => {
    const completedOrders = filteredOrders.filter(order => 
      ['completed', 'prepared', 'ready to pick up'].includes(order.status)
    )
    
    // Group by date
    const dateMap = new Map<string, { total: number; count: number }>()
    
    completedOrders.forEach(order => {
      const completionTime = calculateCompletionTime(order)
      if (completionTime !== null) {
        const dateKey = format(new Date(order.orderTime), 'yyyy-MM-dd')
        const existing = dateMap.get(dateKey) || { total: 0, count: 0 }
        existing.total += completionTime
        existing.count += 1
        dateMap.set(dateKey, existing)
      }
    })
    
    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date: format(new Date(date), 'MMM dd'),
        avgTime: data.count > 0 ? data.total / data.count : 0,
        count: data.count
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [filteredOrders, calculateCompletionTime])

  // Most sold items
  const mostSoldItems = useMemo(() => {
    const itemMap = new Map<string, {
      quantity: number
      weight: number
      revenue: number
      orderCount: Set<string>
    }>()
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const englishName = extractEnglishName(item.name)
        const existing = itemMap.get(englishName) || {
          quantity: 0,
          weight: 0,
          revenue: 0,
          orderCount: new Set<string>()
        }
        
        existing.quantity += item.quantity
        existing.orderCount.add(order.id)
        
        const weight = getItemWeight(order, item.name)
        existing.weight += weight
        
        const revenue = getItemRevenue(order, item.name)
        existing.revenue += revenue
        
        itemMap.set(englishName, existing)
      })
    })
    
    return Array.from(itemMap.entries())
      .map(([itemName, data]) => ({
        itemName,
        totalQuantity: data.quantity,
        totalWeight: data.weight,
        totalRevenue: data.revenue,
        orderCount: data.orderCount.size
      }))
      .sort((a, b) => b.totalWeight - a.totalWeight)
      .slice(0, 10)
  }, [filteredOrders, getItemWeight, getItemRevenue])

  // Rejection rate
  const rejectionStats = useMemo(() => {
    const rejected = filteredOrders.filter(order => order.status === 'rejected')
    const total = filteredOrders.length
    const rejectionRate = total > 0 ? (rejected.length / total) * 100 : 0
    
    // Get rejection reasons
    const reasons = new Map<string, number>()
    rejected.forEach(order => {
      const reason = order.rejectionReason || 'No reason provided'
      reasons.set(reason, (reasons.get(reason) || 0) + 1)
    })
    
    return {
      rejected: rejected.length,
      total,
      rejectionRate,
      reasons: Array.from(reasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }
  }, [filteredOrders])

  // Revenue by category
  const revenueByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>()
    let totalRev = 0
    
    const inferCategory = (itemName: string): string => {
      const name = itemName.toLowerCase()
      if (name.includes('chicken')) return 'chicken'
      if (name.includes('mutton') || name.includes('lamb')) return 'mutton'
      if (name.includes('beef')) return 'beef'
      if (name.includes('seawater') || name.includes('king fish') || name.includes('ayakoora')) return 'seawater fish'
      if (name.includes('freshwater') || name.includes('pond')) return 'freshwater fish'
      return 'other'
    }
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const category = item.category || inferCategory(item.name)
        const revenue = getItemRevenue(order, item.name)
        categoryMap.set(category, (categoryMap.get(category) || 0) + revenue)
        totalRev += revenue
      })
    })
    
    return Array.from(categoryMap.entries())
      .map(([category, revenue]) => ({
        category,
        revenue,
        percentage: totalRev > 0 ? (revenue / totalRev) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [filteredOrders, getItemRevenue])

  // Peak hours
  const peakHours = useMemo(() => {
    const hourCounts = new Map<number, number>()
    
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.orderTime)
      const hour = orderDate.getHours()
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
    })
    
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourCounts.get(hour) || 0
    }))
  }, [filteredOrders])

  // Order status breakdown
  const statusBreakdown = useMemo(() => {
    const statusMap = new Map<string, number>()
    
    filteredOrders.forEach(order => {
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1)
    })
    
    return Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: filteredOrders.length > 0 ? (count / filteredOrders.length) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
  }, [filteredOrders])

  // Revenue trends over time
  const revenueTrendData = useMemo(() => {
    const dateMap = new Map<string, number>()
    
    filteredOrders.forEach(order => {
      const dateKey = format(new Date(order.orderTime), 'yyyy-MM-dd')
      let revenue = 0
      if (order.itemRevenues) {
        revenue = Object.values(order.itemRevenues).reduce((sum, rev) => sum + rev, 0)
      } else {
        revenue = order.revenue || 0
      }
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + revenue)
    })
    
    return Array.from(dateMap.entries())
      .map(([date, revenue]) => ({
        date: format(new Date(date), 'MMM dd'),
        revenue
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [filteredOrders])

  // Item-wise revenue contribution
  const itemRevenueContribution = useMemo(() => {
    const itemMap = new Map<string, number>()
    let totalRev = 0
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const englishName = extractEnglishName(item.name)
        const revenue = getItemRevenue(order, item.name)
        itemMap.set(englishName, (itemMap.get(englishName) || 0) + revenue)
        totalRev += revenue
      })
    })
    
    return Array.from(itemMap.entries())
      .map(([itemName, revenue]) => ({
        itemName,
        revenue,
        percentage: totalRev > 0 ? (revenue / totalRev) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [filteredOrders, getItemRevenue])

  // Cut type analysis (meat butchers only)
  const cutTypeAnalysis = useMemo(() => {
    if (!selectedButcher || getButcherTypeFromConfig(selectedButcher) !== 'meat') {
      return []
    }
    
    const cutMap = new Map<string, { quantity: number; revenue: number }>()
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.cutType) {
          const existing = cutMap.get(item.cutType) || { quantity: 0, revenue: 0 }
          existing.quantity += item.quantity
          existing.revenue += getItemRevenue(order, item.name)
          cutMap.set(item.cutType, existing)
        }
      })
    })
    
    return Array.from(cutMap.entries())
      .map(([cutType, data]) => ({
        cutType,
        quantity: data.quantity,
        revenue: data.revenue
      }))
      .sort((a, b) => b.quantity - a.quantity)
  }, [filteredOrders, selectedButcher, getItemRevenue])

  // Price comparison - average prices per item
  const priceComparison = useMemo(() => {
    const itemPriceMap = new Map<string, { totalRevenue: number; totalWeight: number; count: number }>()
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const englishName = extractEnglishName(item.name)
        const revenue = getItemRevenue(order, item.name)
        const weight = getItemWeight(order, item.name)
        
        const existing = itemPriceMap.get(englishName) || { totalRevenue: 0, totalWeight: 0, count: 0 }
        existing.totalRevenue += revenue
        existing.totalWeight += weight
        existing.count += 1
        itemPriceMap.set(englishName, existing)
      })
    })
    
    return Array.from(itemPriceMap.entries())
      .map(([itemName, data]) => ({
        itemName,
        averagePrice: data.totalWeight > 0 ? data.totalRevenue / data.totalWeight : 0,
        totalRevenue: data.totalRevenue,
        totalWeight: data.totalWeight,
        orderCount: data.count
      }))
      .filter(item => item.averagePrice > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
  }, [filteredOrders, getItemRevenue, getItemWeight])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle>Butcher Performance</CardTitle>
              <CardDescription>Individual butcher performance metrics and analytics</CardDescription>
            </div>
            <Button onClick={onRefresh} disabled={isLoading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="butcher-select">Select Butcher</Label>
              <Select value={selectedButcher} onValueChange={setSelectedButcher}>
                <SelectTrigger id="butcher-select">
                  <SelectValue placeholder="Select Butcher" />
                </SelectTrigger>
                <SelectContent>
                  {freshButchers.map(butcher => (
                    <SelectItem key={butcher.id} value={butcher.id}>
                      {butcher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="date-filter">Date Filter</Label>
              <Select value={dateFilter} onValueChange={(value: 'all' | 'today' | 'custom') => setDateFilter(value)}>
                <SelectTrigger id="date-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="custom">Custom Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateFilter === 'custom' && (
              <>
                <div className="flex-1">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
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

      {!selectedButcher ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Please select a butcher to view performance metrics</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredOrders.length}</div>
                <p className="text-xs text-muted-foreground">All orders in selected period</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground">Total revenue generated</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Kilograms</CardTitle>
                <Weight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalKilograms.toFixed(2)}kg</div>
                <p className="text-xs text-muted-foreground">Total weight sold</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{averageOrderValue.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">Average revenue per order</p>
              </CardContent>
            </Card>
          </div>

          {/* Timing Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Timing Analysis</CardTitle>
              <CardDescription>Order completion time trends and averages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  {completionTimeTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={completionTimeTrendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="avgTime" stroke="#8884d8" name="Avg Completion Time (min)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No completion time data available
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  {averageCompletionTime !== null ? (
                    <div className="text-center p-6 bg-muted rounded-lg">
                      <div className="text-4xl font-bold mb-2">{averageCompletionTime.toFixed(1)} min</div>
                      <p className="text-sm text-muted-foreground">Average Completion Time</p>
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-muted rounded-lg">
                      <p className="text-muted-foreground">No completion time data available</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Most Sold Items */}
          <Card>
            <CardHeader>
              <CardTitle>Most Sold Items</CardTitle>
              <CardDescription>Top 10 items by quantity/weight sold</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Weight (kg)</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mostSoldItems.length > 0 ? (
                        mostSoldItems.map((item, index) => (
                          <TableRow key={item.itemName}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">#{index + 1}</span>
                                {item.itemName}
                              </div>
                            </TableCell>
                            <TableCell>{item.totalWeight.toFixed(2)}kg</TableCell>
                            <TableCell className="text-right">₹{item.totalRevenue.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{item.orderCount}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No items data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  {mostSoldItems.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={mostSoldItems.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="itemName" angle={-45} textAnchor="end" height={100} />
                        <YAxis label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Bar dataKey="totalWeight" fill="#00C49F" name="Weight (kg)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      No items data available
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Item Price Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Item Price Comparison</CardTitle>
              <CardDescription>Average selling prices per item (₹ per kg)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Avg Price/kg</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceComparison.length > 0 ? (
                        priceComparison.map((item) => (
                          <TableRow key={item.itemName}>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell className="text-right">₹{item.averagePrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right">₹{item.totalRevenue.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{item.orderCount}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No price data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  {priceComparison.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={priceComparison.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="itemName" angle={-45} textAnchor="end" height={100} />
                        <YAxis label={{ value: 'Price (₹/kg)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}/kg`} />
                        <Bar dataKey="averagePrice" fill="#00C49F" name="Avg Price (₹/kg)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      No price data available
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Analytics Grid */}
          <div className="space-y-6">
            {/* Item Revenue Contribution & Revenue Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Item Revenue Contribution</CardTitle>
                  <CardDescription>Top items by revenue contribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemRevenueContribution.length > 0 ? (
                        itemRevenueContribution.map((item) => (
                          <TableRow key={item.itemName}>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell className="text-right">₹{item.revenue.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{item.percentage.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                            No revenue data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                  <CardDescription>Revenue distribution by butcher over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={revenueTrendData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis label={{ value: 'Revenue (₹)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                        <Area type="monotone" dataKey="revenue" stroke="#8884d8" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No revenue trend data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Revenue by Category & Peak Hours */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Category</CardTitle>
                  <CardDescription>Revenue distribution across categories</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={revenueByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="revenue"
                        >
                          {revenueByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No category data available
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Peak Hours</CardTitle>
                  <CardDescription>Order volume by hour of day</CardDescription>
                </CardHeader>
                <CardContent>
                  {peakHours.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={peakHours}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#00C49F" name="Orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No peak hours data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Order Status Breakdown & Rejection Rate */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Order Status Breakdown</CardTitle>
                  <CardDescription>Distribution of order statuses</CardDescription>
                </CardHeader>
                <CardContent>
                  {statusBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={statusBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ status, percentage }) => `${status}: ${percentage.toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {statusBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No status data available
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Rejection Rate</CardTitle>
                  <CardDescription>Order rejection statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rejected Orders</span>
                      <span className="text-2xl font-bold">{rejectionStats.rejected}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rejection Rate</span>
                      <Badge variant={rejectionStats.rejectionRate > 20 ? "destructive" : rejectionStats.rejectionRate > 10 ? "secondary" : "default"}>
                        {rejectionStats.rejectionRate.toFixed(1)}%
                      </Badge>
                    </div>
                    {rejectionStats.reasons.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Top Reasons</p>
                        <div className="space-y-1">
                          {rejectionStats.reasons.map((reason, index) => (
                            <div key={index} className="flex justify-between text-xs">
                              <span className="text-muted-foreground truncate">{reason.reason}</span>
                              <span className="font-medium">{reason.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Cut Type Analysis (Meat Butchers Only) */}
          {cutTypeAnalysis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cut Type Analysis</CardTitle>
                <CardDescription>Analysis by cut type (Meat Butchers Only)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cut Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cutTypeAnalysis.map((cut) => (
                      <TableRow key={cut.cutType}>
                        <TableCell className="font-medium">{cut.cutType}</TableCell>
                        <TableCell className="text-right">{cut.quantity}</TableCell>
                        <TableCell className="text-right">₹{cut.revenue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

