"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import { Skeleton } from "../../../components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { useToast } from "../../../hooks/use-toast"
import { useAuth } from "../../../context/AuthContext"
import type { Order } from "../../../lib/types"
import { IndianRupee, ShoppingCart, Timer, CheckCircle, XCircle, TrendingUp, Weight, RefreshCw, AlertCircle, Calendar, FileText } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "../../../components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { format } from "date-fns"
import { useState, useEffect, useCallback } from "react"
import { useOrderPolling } from "../../../hooks/useOrderPolling"
import { useClientCache } from "../../../hooks/useClientCache"
import { getCommissionRate } from "../../../lib/rates"

// Helper function to extract order number from full order ID for display
const getDisplayOrderId = (orderId: string): string => {
  // Extract order number from ID like "ORD-2024-01-15-123" -> "ORD-123"
  const orderIdParts = orderId.replace('ORD-', '').split('-');
  const orderNumber = orderIdParts[orderIdParts.length - 1]; // Get the last part (order number)
  return `ORD-${orderNumber}`;
};

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export default function AnalyticsPage() {
  const { butcher, admin, isAdmin } = useAuth();
  const { toast } = useToast();
  const { clear: clearCache } = useClientCache();
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  

  // Use slower polling for analytics to avoid quota limits
  const { orders, isLoading, error, refetch } = useOrderPolling({
    butcherId: butcher?.id || '',
    pollingInterval: 30000, // 30-second interval for analytics (2 requests/minute)
    enabled: !!butcher
  });

  // Fetch all orders for admin users
  const fetchAllOrders = useCallback(async () => {
    if (!isAdmin) return;
    
    setIsLoadingAll(true);
    try {
      const butcherIds = ['usaj', 'usaj_mutton', 'pkd', 'kak', 'ka_sons', 'alif'];
      const allOrdersData: Order[] = [];
      
      for (const butcherId of butcherIds) {
        try {
          const response = await fetch(`/api/orders/${butcherId}`);
          if (response.ok) {
            const data = await response.json();
            allOrdersData.push(...data.orders);
          }
        } catch (error) {
          console.error(`Error fetching orders for ${butcherId}:`, error);
        }
      }
      
      setAllOrders(allOrdersData);
    } catch (error) {
      console.error('Error fetching all orders:', error);
    } finally {
      setIsLoadingAll(false);
    }
  }, [isAdmin]);

  // Enhanced refetch that clears cache
  const forceRefresh = useCallback(async () => {
    if (isAdmin) {
      console.log('Analytics: Force refreshing all orders for admin');
      await fetchAllOrders();
    } else if (butcher?.id) {
      console.log('Analytics: Clearing cache and force refreshing');
      // Clear all possible cache keys
      clearCache(`orders_${butcher.id}`);
      clearCache(`orders_${butcher.id}_*`);
      // Add a small delay to ensure cache is cleared
      await new Promise(resolve => setTimeout(resolve, 100));
      await refetch();
    }
  }, [isAdmin, butcher?.id, clearCache, refetch, fetchAllOrders]);

  // Load all orders for admin on mount
  useEffect(() => {
    if (isAdmin) {
      fetchAllOrders();
    }
  }, [isAdmin, fetchAllOrders]);

  if (!butcher && !isAdmin) return null;

  // Get today's date for filtering
  const today = new Date();
  const todayString = today.toDateString();
  
  // Use appropriate orders based on user type
  const currentOrders = isAdmin ? allOrders : orders;
  const currentIsLoading = isAdmin ? isLoadingAll : isLoading;
  
  // Filter orders by date first, then by status
  const todayOrders = currentOrders.filter(order => {
    const orderDate = new Date(order.orderTime);
    const orderDateString = orderDate.toDateString();
    const isToday = orderDateString === todayString;
    
    // Debug logging for date filtering
    if (currentOrders.length > 0 && currentOrders.indexOf(order) < 3) { // Log first 3 orders for debugging
      console.log(`Analytics date filter: Order ${order.id}, orderDate: ${orderDateString}, today: ${todayString}, isToday: ${isToday}`);
    }
    
    return isToday;
  });
  
  const completedOrders = todayOrders.filter(o => ['completed', 'prepared', 'ready to pick up'].includes(o.status));
  const declinedOrders = todayOrders.filter(o => o.status === 'rejected' || o.rejectionReason);
  
  // Debug: Log all orders and their statuses
  console.log('Analytics: All today orders with statuses:', todayOrders.map(order => ({
    id: order.id,
    status: order.status,
    hasRevenue: !!order.revenue,
    revenue: order.revenue
  })));
  
  console.log('Analytics: Filtered completed orders:', completedOrders.map(order => ({
    id: order.id,
    status: order.status,
    revenue: order.revenue
  })));

  // Force refresh on component mount to get latest data
  useEffect(() => {
    if (butcher?.id) {
      console.log('Analytics: Force refreshing data on mount');
      forceRefresh();
    }
  }, [butcher?.id, forceRefresh]);

  // Debug: Log order data when it changes
  useEffect(() => {
    if (orders.length > 0) {
      console.log('Analytics: Orders data updated:', {
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        sampleOrder: completedOrders[0] ? {
          id: completedOrders[0].id,
          revenue: completedOrders[0].revenue,
          pickedWeight: completedOrders[0].pickedWeight,
          status: completedOrders[0].status
        } : null
      });
      
      // Log all completed orders with their revenue
      console.log('Analytics: All completed orders revenue details:');
      completedOrders.forEach((order, index) => {
        console.log(`Order ${index + 1}:`, {
          id: order.id,
          revenue: order.revenue,
          itemRevenues: order.itemRevenues,
          pickedWeight: order.pickedWeight,
          status: order.status,
          items: order.items.map(item => ({ name: item.name, quantity: item.quantity }))
        });
      });
    }
  }, [orders, completedOrders]);

  // Show error toast if there's an issue
  useEffect(() => {
    if (error) {
      toast({ 
        variant: "destructive", 
        title: "Failed to load analytics data", 
        description: error 
      });
    }
  }, [error, toast]);
  
  // Calculate revenue based on actual stored revenue or item revenues
  const calculateOrderRevenue = (order: Order): number => {
    console.log(`\n=== ANALYTICS REVENUE CALCULATION for Order ${order.id} ===`);
    console.log('Order details:', {
      orderId: order.id,
      hasRevenue: !!order.revenue,
      revenue: order.revenue,
      hasItemRevenues: !!order.itemRevenues,
      itemRevenues: order.itemRevenues,
      pickedWeight: order.pickedWeight,
      status: order.status,
      items: order.items.map(item => ({ name: item.name, quantity: item.quantity }))
    });
    
    // Use stored revenue if available
    if (order.revenue) {
      console.log(`✅ Using stored revenue: ₹${order.revenue}`);
      return order.revenue;
    }
    
    // Use item revenues if available (sum of all item revenues)
    if (order.itemRevenues) {
      const itemRevenueSum = Object.values(order.itemRevenues).reduce((sum, revenue) => sum + revenue, 0);
      console.log(`✅ Using item revenues sum: ₹${itemRevenueSum}`, order.itemRevenues);
      return itemRevenueSum;
    }
    
    console.log(`⚠️ No stored revenue found, using fallback calculation`);
    
    // Fallback: calculate based on preparing weight with commission
    const preparingWeight = order.pickedWeight || 0;
    if (preparingWeight > 0) {
      // Get commission rate for default category (using default rates for fallback calculations)
      const commission = getCommissionRate(butcher.id, 'default');
      const defaultPricePerKg = 450; // Default purchase price
      const totalValue = preparingWeight * defaultPricePerKg;
      const fallbackRevenue = totalValue - (totalValue * commission);
      console.log(`⚠️ Fallback calculation: ${preparingWeight}kg × ₹${defaultPricePerKg} - ${commission*100}% = ₹${fallbackRevenue}`);
      return fallbackRevenue;
    }
    
    // Final fallback: estimate based on item quantity
    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const finalFallback = totalQuantity * 450; // Default rate
    console.log(`⚠️ Final fallback: ${totalQuantity} × ₹450 = ₹${finalFallback}`);
    console.log(`==========================================\n`);
    return finalFallback;
  };
  
  // Calculate total revenue including declined orders (negative revenue)
  const completedRevenue = completedOrders.reduce((acc, order) => acc + calculateOrderRevenue(order), 0);
  const declinedRevenue = declinedOrders.reduce((acc, order) => {
    // For declined orders, show negative revenue (loss) but don't add to total
    const estimatedRevenue = calculateOrderRevenue(order);
    return acc - estimatedRevenue; // Negative revenue for declined orders
  }, 0);
  
  // Total revenue only includes completed orders, declined orders are shown separately
  const totalRevenue = completedRevenue;
  
  // Debug: Log revenue calculation details
  console.log('Analytics: Revenue calculation summary:', {
    completedOrdersCount: completedOrders.length,
    completedRevenue: completedRevenue,
    declinedOrdersCount: declinedOrders.length,
    declinedRevenue: declinedRevenue,
    totalRevenue: totalRevenue,
    revenueBreakdown: completedOrders.map(order => ({
      id: order.id,
      revenue: order.revenue,
      calculatedRevenue: calculateOrderRevenue(order)
    }))
  });
  const totalOrders = completedOrders.length + declinedOrders.length;
  
  // Calculate total weight sold from preparing weights
  const totalWeightSold = completedOrders.reduce((acc, order) => {
    return acc + (order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0));
  }, 0);
  
  // Calculate preparation time only for orders that have both start and end times
  const ordersWithPrepTime = completedOrders.filter(order => 
    order.preparationEndTime && order.preparationStartTime
  );
  
  const totalPrepTime = ordersWithPrepTime.reduce((acc, order) => {
    return acc + (order.preparationEndTime!.getTime() - order.preparationStartTime!.getTime());
  }, 0);
  
  // Calculate average only for orders that actually have preparation times
  const avgPrepTimeInMinutes = ordersWithPrepTime.length > 0 ? (totalPrepTime / ordersWithPrepTime.length / (1000 * 60)) : 0;
  
  // Debug: Log preparation time calculation details
  console.log('Analytics: Preparation time calculation:', {
    completedOrdersCount: completedOrders.length,
    ordersWithPrepTimeCount: ordersWithPrepTime.length,
    totalPrepTimeMs: totalPrepTime,
    avgPrepTimeMinutes: avgPrepTimeInMinutes,
    ordersWithPrepTime: ordersWithPrepTime.map(order => ({
      id: order.id,
      startTime: order.preparationStartTime,
      endTime: order.preparationEndTime,
      duration: order.preparationEndTime && order.preparationStartTime ? 
        (order.preparationEndTime.getTime() - order.preparationStartTime.getTime()) / (1000 * 60) : 0
    }))
  });
  
  // Use the already filtered todayOrders for daily analytics
  const dailyOrders = todayOrders;
  const todayDeclinedOrders = declinedOrders;

  // Weekly report calculations
  const getWeekDateRange = () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6); // 7 days including today
    return { weekStart, weekEnd: today };
  };

  const { weekStart, weekEnd } = getWeekDateRange();
  const weeklyOrders = orders.filter(o => {
    const orderDate = new Date(o.orderTime);
    return orderDate >= weekStart && orderDate <= weekEnd;
  });

  const weeklyCompletedOrders = weeklyOrders.filter(o => ['completed', 'prepared'].includes(o.status));
  const weeklyDeclinedOrders = weeklyOrders.filter(o => o.status === 'rejected' || o.rejectionReason);
  const weeklyRevenue = weeklyCompletedOrders.reduce((acc, order) => acc + calculateOrderRevenue(order), 0);
  const weeklyWeightSold = weeklyCompletedOrders.reduce((acc, order) => {
    return acc + (order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0));
  }, 0);

  // Daily breakdown for the week
  const dailyBreakdown = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = date.toDateString();
    const dayOrders = orders.filter(o => new Date(o.orderTime).toDateString() === dateString);
    const dayCompletedOrders = dayOrders.filter(o => ['completed', 'prepared'].includes(o.status));
    const dayRevenue = dayCompletedOrders.reduce((acc, order) => acc + calculateOrderRevenue(order), 0);
    const dayWeight = dayCompletedOrders.reduce((acc, order) => {
      return acc + (order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0));
    }, 0);

    dailyBreakdown.push({
      date: format(date, 'MMM dd'),
      fullDate: dateString,
      orders: dayOrders.length,
      completedOrders: dayCompletedOrders.length,
      revenue: dayRevenue,
      weight: dayWeight
    });
  }

  // Monthly report calculations
  const getMonthDateRange = () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { monthStart, monthEnd };
  };

  const { monthStart, monthEnd } = getMonthDateRange();
  const monthlyOrders = orders.filter(o => {
    const orderDate = new Date(o.orderTime);
    return orderDate >= monthStart && orderDate <= monthEnd;
  });

  const monthlyCompletedOrders = monthlyOrders.filter(o => ['completed', 'prepared'].includes(o.status));
  const monthlyDeclinedOrders = monthlyOrders.filter(o => o.status === 'rejected' || o.rejectionReason);
  const monthlyRevenue = monthlyCompletedOrders.reduce((acc, order) => acc + calculateOrderRevenue(order), 0);
  const monthlyWeightSold = monthlyCompletedOrders.reduce((acc, order) => {
    return acc + (order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0));
  }, 0);

  // Weekly breakdown for the month
  const weeklyBreakdown = [];
  const currentDate = new Date(monthStart);
  while (currentDate <= monthEnd) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(currentDate.getDate() + 6);
    
    // Don't go beyond month end
    if (weekEnd > monthEnd) {
      weekEnd.setTime(monthEnd.getTime());
    }

    const weekOrders = orders.filter(o => {
      const orderDate = new Date(o.orderTime);
      return orderDate >= weekStart && orderDate <= weekEnd;
    });
    
    const weekCompletedOrders = weekOrders.filter(o => ['completed', 'prepared'].includes(o.status));
    const weekRevenue = weekCompletedOrders.reduce((acc, order) => acc + calculateOrderRevenue(order), 0);
    const weekWeight = weekCompletedOrders.reduce((acc, order) => {
      return acc + (order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0));
    }, 0);

    weeklyBreakdown.push({
      week: `Week ${Math.ceil((currentDate.getDate()) / 7)}`,
      dateRange: `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`,
      fullDate: weekStart.toDateString(),
      orders: weekOrders.length,
      completedOrders: weekCompletedOrders.length,
      revenue: weekRevenue,
      weight: weekWeight
    });

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }

  const chartData = dailyOrders.map(order => ({
    id: order.id,
    revenue: (order.status === 'rejected' || order.rejectionReason) ? -calculateOrderRevenue(order) : calculateOrderRevenue(order),
  }));

  // Calculate item-wise statistics for today only
  // completedOrders is already filtered to today's orders
  const itemStats = completedOrders.reduce((acc, order) => {
    const orderRevenue = calculateOrderRevenue(order);
    const orderWeight = order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0);
    
    order.items.forEach((item, index) => {
      if (!acc[item.name]) {
        acc[item.name] = { totalWeight: 0, totalRevenue: 0, count: 0 };
      }
      
      // Distribute weight and revenue proportionally based on item quantity
      const itemProportion = item.quantity / order.items.reduce((sum, i) => sum + i.quantity, 0);
      const itemWeight = orderWeight * itemProportion;
      const itemRevenue = orderRevenue * itemProportion;
      
      acc[item.name].totalWeight += itemWeight;
      acc[item.name].totalRevenue += itemRevenue;
      acc[item.name].count += 1;
    });
    return acc;
  }, {} as Record<string, { totalWeight: number; totalRevenue: number; count: number }>);

  // Total weight sold today
  const dailyWeightSold = completedOrders.reduce((acc, order) => {
    return acc + (order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0));
  }, 0);

  const getStatusBadge = (order: Order) => {
    // If order has rejection reason, show the rejection message
    if (order.rejectionReason) {
      return <Badge variant="destructive" title={order.rejectionReason}>
        {order.rejectionReason.length > 20 ? order.rejectionReason.substring(0, 20) + '...' : order.rejectionReason}
      </Badge>;
    }
    
    switch (order.status) {
      case 'completed': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Completed</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      case 'prepared': return <Badge variant="secondary">Prepared</Badge>;
      default: return <Badge variant="outline">{order.status}</Badge>;
    }
  }

  const getPrepTime = (order: Order) => {
    if (order.preparationEndTime && order.preparationStartTime) {
      const diff = order.preparationEndTime.getTime() - order.preparationStartTime.getTime();
      return `${Math.floor(diff / (1000 * 60))}m ${Math.floor((diff / 1000) % 60)}s`;
    }
    return 'N/A';
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="analytics" className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>
            {isAdmin && <p className="text-muted-foreground">Admin view - All butchers data</p>}
          </div>
        <div className="flex items-center gap-4">
          <Button 
            variant={showWeeklyReport ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowWeeklyReport(!showWeeklyReport)}
          >
            <Calendar className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">
              {showWeeklyReport ? 'Hide Weekly Report' : 'Weekly Report'}
            </span>
          </Button>
          <Button 
            variant={showMonthlyReport ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowMonthlyReport(!showMonthlyReport)}
          >
            <Calendar className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">
              {showMonthlyReport ? 'Hide Monthly Report' : 'Monthly Report'}
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={forceRefresh} disabled={currentIsLoading}>
            <RefreshCw className={`h-4 w-4 ${currentIsLoading ? 'animate-spin' : ''}`} />
            <span className="ml-2 hidden sm:inline">Refresh Data</span>
          </Button>
          {error && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Data sync error</span>
            </div>
          )}
        </div>
      </div>

      {/* Daily Analytics Section */}
      <div className="space-y-6">
        <Card className="border-primary bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" />
              Today's Performance ({format(new Date(), 'MMM dd, yyyy')})
            </CardTitle>
            <CardDescription>
              Real-time overview of today's sales and operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {dailyOrders.length}
                </div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {completedOrders.length}
                </div>
                <p className="text-sm text-muted-foreground">Completed Orders</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {dailyWeightSold.toFixed(2)} kg
                </div>
                <p className="text-sm text-muted-foreground">Total Weight Sold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Orders</CardTitle>
            <CardDescription>A detailed list of all orders processed today.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prep. Time</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyOrders.length > 0 ? dailyOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{getDisplayOrderId(order.id)}</TableCell>
                      <TableCell>{getStatusBadge(order)}</TableCell>
                      <TableCell>{getPrepTime(order)}</TableCell>
                      <TableCell className="text-right">
                        ₹{calculateOrderRevenue(order).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  )) : (
                     <TableRow>
                       <TableCell colSpan={4} className="h-24 text-center">
                         No orders today.
                       </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Report Section */}
      {showWeeklyReport && (
        <div className="space-y-6">
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <FileText className="h-5 w-5" />
                Weekly Report ({format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')})
              </CardTitle>
              <CardDescription className="text-blue-600 dark:text-blue-400">
                Summary of the past 7 days performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    ₹{weeklyRevenue.toLocaleString('en-IN')}
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Total Revenue</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {weeklyOrders.length}
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Total Orders</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {weeklyCompletedOrders.length}
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Completed Orders</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {weeklyWeightSold.toFixed(2)} kg
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Total Weight Sold</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Performance Breakdown</CardTitle>
              <CardDescription>Revenue and orders for each day of the week</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart accessibilityLayer data={dailyBreakdown}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Daily Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown Details</CardTitle>
              <CardDescription>Detailed statistics for each day of the week</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Completed Orders</TableHead>
                    <TableHead>Weight Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyBreakdown.map((day) => (
                    <TableRow key={day.fullDate}>
                      <TableCell className="font-medium">{day.date}</TableCell>
                      <TableCell>{day.orders}</TableCell>
                      <TableCell>{day.completedOrders}</TableCell>
                      <TableCell>{day.weight.toFixed(2)} kg</TableCell>
                      <TableCell className="text-right">₹{day.revenue.toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Report Section */}
      {showMonthlyReport && (
        <div className="space-y-6">
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <FileText className="h-5 w-5" />
                Monthly Report ({format(monthStart, 'MMM dd')} - {format(monthEnd, 'MMM dd, yyyy')})
              </CardTitle>
              <CardDescription className="text-green-600 dark:text-green-400">
                Summary of the current month's performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    ₹{monthlyRevenue.toLocaleString('en-IN')}
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">Total Revenue</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {monthlyOrders.length}
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">Total Orders</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {monthlyCompletedOrders.length}
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">Completed Orders</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {monthlyWeightSold.toFixed(2)} kg
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">Total Weight Sold</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Breakdown Chart for Month */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Performance Breakdown</CardTitle>
              <CardDescription>Revenue and orders for each week of the month</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart accessibilityLayer data={weeklyBreakdown}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Weekly Breakdown Table for Month */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Breakdown Details</CardTitle>
              <CardDescription>Detailed statistics for each week of the month</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Completed Orders</TableHead>
                    <TableHead>Weight Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyBreakdown.map((week) => (
                    <TableRow key={week.fullDate}>
                      <TableCell className="font-medium">{week.week}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{week.dateRange}</TableCell>
                      <TableCell>{week.orders}</TableCell>
                      <TableCell>{week.completedOrders}</TableCell>
                      <TableCell>{week.weight.toFixed(2)} kg</TableCell>
                      <TableCell className="text-right">₹{week.revenue.toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue Today</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {currentIsLoading ? (
              <>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">₹{completedOrders.reduce((acc, order) => acc + calculateOrderRevenue(order), 0).toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground">From {completedOrders.length} completed orders today {todayDeclinedOrders.length > 0 && `(${todayDeclinedOrders.length} declined shown separately)`}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders Today</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {currentIsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-28" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{dailyOrders.length}</div>
                <p className="text-xs text-muted-foreground">{completedOrders.length} completed today</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Weight Sold Today</CardTitle>
            <Weight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {currentIsLoading ? (
              <>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-24" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{dailyWeightSold.toFixed(2)} kg</div>
                <p className="text-xs text-muted-foreground">Across all items today</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Preparation Time</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {currentIsLoading ? (
              <>
                <Skeleton className="h-8 w-18 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{avgPrepTimeInMinutes.toFixed(1)} min</div>
                <p className="text-xs text-muted-foreground">Across all completed orders</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Declined Orders Card - Show separately */}
      {todayDeclinedOrders.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Declined Orders Today</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              -₹{todayDeclinedOrders.reduce((acc, order) => acc + calculateOrderRevenue(order), 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">
              Lost revenue from {todayDeclinedOrders.length} declined orders (not included in total)
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Today's Revenue by Order</CardTitle>
            <CardDescription>A summary of revenue generated from each order today.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="id"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(-3)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(value) => `₹${value}`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Item-wise Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Item-wise Sales Today</CardTitle>
          <CardDescription>Weight sold and revenue generated for each item today.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Total Weight Sold</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(itemStats).length > 0 ? Object.entries(itemStats).map(([itemName, stats]) => (
                <TableRow key={itemName}>
                  <TableCell className="font-medium">{itemName}</TableCell>
                  <TableCell>{stats.totalWeight.toFixed(2)} kg</TableCell>
                  <TableCell>{stats.count}</TableCell>
                  <TableCell className="text-right">₹{stats.totalRevenue.toFixed(2)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No sales data available today.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

    </div>
  )
}
