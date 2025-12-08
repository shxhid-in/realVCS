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
import { toDate, getTimeValue } from "../../../lib/utils"

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

// Helper function to get IST date string (DD/MM/YYYY)
const getISTDateString = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper function to parse DD/MM/YYYY to Date
const parseISTDate = (dateStr: string): Date | null => {
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    if (day && month && year) {
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  } catch (e) {
    // Silently handle date parsing errors
  }
  return null;
};

// Helper function to get Monday of current week
const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Helper function to get Sunday of current week
const getSundayOfWeek = (date: Date): Date => {
  const monday = getMondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
};

// Helper function to get first day of current month
const getFirstDayOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

// Helper function to get last day of current month
const getLastDayOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

export default function AnalyticsPage() {
  const { butcher, admin, isAdmin } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all orders from sheet with pagination
  const fetchOrdersFromSheet = useCallback(async (butcherId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      let allOrdersData: Order[] = [];
      let page = 1;
      let hasMore = true;

      // Fetch all pages sequentially
      while (hasMore) {
        const response = await fetch(`/api/analytics/${butcherId}?page=${page}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch analytics data');
        }

        const data = await response.json();
        allOrdersData = [...allOrdersData, ...data.orders];
        
        hasMore = data.pagination.hasMore;
        page++;
      }

      setOrders(allOrdersData);
    } catch (err: any) {
      setError(err.message || 'Try again later');
      toast({
        variant: "destructive",
        title: "Failed to load analytics data",
        description: "Try again later"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch all orders for admin users
  const fetchAllOrders = useCallback(async () => {
    if (!isAdmin) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const butcherIds = ['usaj', 'usaj_mutton', 'pkd', 'kak', 'ka_sons', 'alif'];
      const allOrdersData: Order[] = [];
      
      for (const butcherId of butcherIds) {
        try {
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const response = await fetch(`/api/analytics/${butcherId}?page=${page}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              allOrdersData.push(...data.orders);
              hasMore = data.pagination.hasMore;
              page++;
            } else {
              hasMore = false;
            }
          }
        } catch (error) {
          // Silently handle individual butcher fetch errors
        }
      }
      
      setOrders(allOrdersData);
    } catch (error: any) {
      setError(error.message || 'Try again later');
      toast({
        variant: "destructive",
        title: "Failed to load analytics data",
        description: "Try again later"
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, toast]);

  // Refresh button handler
  const handleRefresh = useCallback(async () => {
    if (isAdmin) {
      await fetchAllOrders();
    } else if (butcher?.id) {
      await fetchOrdersFromSheet(butcher.id);
    }
  }, [isAdmin, butcher?.id, fetchAllOrders, fetchOrdersFromSheet]);

  // Load orders on mount
  useEffect(() => {
    if (isAdmin) {
      fetchAllOrders();
    } else if (butcher?.id) {
      fetchOrdersFromSheet(butcher.id);
    }
  }, [isAdmin, butcher?.id, fetchAllOrders, fetchOrdersFromSheet]);

  if (!butcher && !isAdmin) return null;

  // Get today's date in IST format for filtering
  const today = new Date();
  const todayIST = getISTDateString(today);
  
  // Filter orders by date from sheet (Order Date column is in DD/MM/YYYY format)
  const todayOrders = orders.filter(order => {
    // Parse order date from orderTime (which comes from sheet)
    const orderDateStr = getISTDateString(new Date(order.orderTime));
    return orderDateStr === todayIST;
  });
  
  // ✅ FIX: Remove duplicates by order.id to prevent duplicate key errors
  const uniqueTodayOrders = new Map<string, Order>();
  todayOrders.forEach(order => {
    if (!uniqueTodayOrders.has(order.id)) {
      uniqueTodayOrders.set(order.id, order);
    }
  });
  const deduplicatedTodayOrders = Array.from(uniqueTodayOrders.values());

  // Weekly: Monday to Sunday of current week
  const monday = getMondayOfWeek(today);
  const sunday = getSundayOfWeek(today);
  const weeklyOrdersRaw = orders.filter(order => {
    const orderDate = new Date(order.orderTime);
    return orderDate >= monday && orderDate <= sunday;
  });
  // ✅ FIX: Remove duplicates
  const uniqueWeeklyOrders = new Map<string, Order>();
  weeklyOrdersRaw.forEach(order => {
    if (!uniqueWeeklyOrders.has(order.id)) {
      uniqueWeeklyOrders.set(order.id, order);
    }
  });
  const weeklyOrders = Array.from(uniqueWeeklyOrders.values());

  // Monthly: 1st to last day of current month
  const monthStart = getFirstDayOfMonth(today);
  const monthEnd = getLastDayOfMonth(today);
  const monthlyOrdersRaw = orders.filter(order => {
    const orderDate = new Date(order.orderTime);
    return orderDate >= monthStart && orderDate <= monthEnd;
  });
  // ✅ FIX: Remove duplicates
  const uniqueMonthlyOrders = new Map<string, Order>();
  monthlyOrdersRaw.forEach(order => {
    if (!uniqueMonthlyOrders.has(order.id)) {
      uniqueMonthlyOrders.set(order.id, order);
    }
  });
  const monthlyOrders = Array.from(uniqueMonthlyOrders.values());
  
  // Filter orders by status (use deduplicated orders)
  const completedOrders = deduplicatedTodayOrders.filter(o => ['completed', 'prepared', 'ready to pick up'].includes(o.status));
  const declinedOrders = deduplicatedTodayOrders.filter(o => o.status === 'rejected' || o.rejectionReason);
  
  // Calculate revenue based on actual stored revenue or item revenues from sheet
  const calculateOrderRevenueAnalytics = (order: Order): number => {
    // Use item revenues if available (sum of all item revenues)
    if (order.itemRevenues && Object.keys(order.itemRevenues).length > 0) {
      return Object.values(order.itemRevenues).reduce((sum, revenue) => sum + revenue, 0);
    }
    
    // Otherwise, use stored revenue if available
    if (order.revenue) {
      return order.revenue;
    }
    
    // If neither exists, return 0
    return 0;
  };
  
  // Helper function to get preparing weight for a specific item from an order
  const getItemPreparingWeight = (order: Order, itemName: string): number => {
    // Priority 1: Use itemWeights (for fish butchers) - get weight for this specific item
    if (order.itemWeights && order.itemWeights[itemName]) {
      const weightStr = order.itemWeights[itemName];
      if (weightStr && weightStr !== 'rejected') {
        // Parse weight string like "2kg" or "1.5kg" -> extract number
        const match = weightStr.toString().match(/(\d+\.?\d*)/);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }
    
    // Priority 2: Use itemQuantities (for meat butchers) - get quantity for this specific item
    if (order.itemQuantities && order.itemQuantities[itemName]) {
      const qtyStr = order.itemQuantities[itemName];
      if (qtyStr && qtyStr !== 'rejected') {
        // Parse quantity string like "2kg" or "1.5kg" -> extract number
        const match = qtyStr.toString().match(/(\d+\.?\d*)/);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }
    
    // Priority 3: Fall back to item's original quantity
    const item = order.items.find(i => i.name === itemName);
    return item ? item.quantity : 0;
  };

  // Helper function to calculate total preparing weight from an order
  const calculateOrderPreparingWeight = (order: Order): number => {
    // Priority 1: Use itemWeights (for fish butchers) - sum all preparing weights
    if (order.itemWeights && Object.keys(order.itemWeights).length > 0) {
      return Object.values(order.itemWeights).reduce((total, weightStr) => {
        if (!weightStr || weightStr === 'rejected') return total;
        // Parse weight string like "2kg" or "1.5kg" -> extract number
        const match = weightStr.toString().match(/(\d+\.?\d*)/);
        if (match) {
          return total + parseFloat(match[1]);
        }
        return total;
      }, 0);
    }
    
    // Priority 2: Use itemQuantities (for meat butchers) - sum all preparing quantities
    if (order.itemQuantities && Object.keys(order.itemQuantities).length > 0) {
      return Object.values(order.itemQuantities).reduce((total, qtyStr) => {
        if (!qtyStr || qtyStr === 'rejected') return total;
        // Parse quantity string like "2kg" or "1.5kg" -> extract number
        const match = qtyStr.toString().match(/(\d+\.?\d*)/);
        if (match) {
          return total + parseFloat(match[1]);
        }
        return total;
      }, 0);
    }
    
    // Priority 3: Use pickedWeight if available
    if (order.pickedWeight) {
      return order.pickedWeight;
    }
    
    // Priority 4: Fall back to sum of item quantities
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  };
  
  // Calculate total revenue including declined orders (negative revenue)
  const completedRevenue = completedOrders.reduce((acc, order) => acc + calculateOrderRevenueAnalytics(order), 0);
  const declinedRevenue = declinedOrders.reduce((acc, order) => {
    // For declined orders, show negative revenue (loss) but don't add to total
    const estimatedRevenue = calculateOrderRevenueAnalytics(order);
    return acc - estimatedRevenue; // Negative revenue for declined orders
  }, 0);
  
  // Total revenue only includes completed orders, declined orders are shown separately
  const totalRevenue = completedRevenue;
  
  const totalOrders = completedOrders.length + declinedOrders.length;
  
  // Calculate total weight sold from preparing weights
  const totalWeightSold = completedOrders.reduce((acc, order) => {
    return acc + calculateOrderPreparingWeight(order);
  }, 0);
  
  // Calculate preparation time only for orders that have both start and end times
  const ordersWithPrepTime = completedOrders.filter(order => {
    const startTime = toDate(order.preparationStartTime);
    const endTime = toDate(order.preparationEndTime);
    return startTime && endTime;
  });
  
  const totalPrepTime = ordersWithPrepTime.reduce((acc, order) => {
    const startTime = toDate(order.preparationStartTime);
    const endTime = toDate(order.preparationEndTime);
    if (startTime && endTime) {
      return acc + (endTime.getTime() - startTime.getTime());
    }
    return acc;
  }, 0);
  
  // Calculate average only for orders that actually have preparation times
  const avgPrepTimeInMinutes = ordersWithPrepTime.length > 0 ? (totalPrepTime / ordersWithPrepTime.length / (1000 * 60)) : 0;
  
  
  // Weekly report calculations
  const weeklyCompletedOrders = weeklyOrders.filter(o => ['completed', 'prepared'].includes(o.status));
  const weeklyDeclinedOrders = weeklyOrders.filter(o => o.status === 'rejected' || o.rejectionReason);
  const weeklyRevenue = weeklyCompletedOrders.reduce((acc, order) => acc + calculateOrderRevenueAnalytics(order), 0);
  const weeklyWeightSold = weeklyCompletedOrders.reduce((acc, order) => {
    return acc + calculateOrderPreparingWeight(order);
  }, 0);

  // Daily breakdown for the week (Monday to Sunday)
  const dailyBreakdown = [];
  const currentMonday = getMondayOfWeek(today);
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentMonday);
    date.setDate(currentMonday.getDate() + i);
    const dateIST = getISTDateString(date);
    const dayOrders = orders.filter(o => {
      const orderDateStr = getISTDateString(new Date(o.orderTime));
      return orderDateStr === dateIST;
    });
    const dayCompletedOrders = dayOrders.filter(o => ['completed', 'prepared'].includes(o.status));
    const dayRevenue = dayCompletedOrders.reduce((acc, order) => acc + calculateOrderRevenueAnalytics(order), 0);
    const dayWeight = dayCompletedOrders.reduce((acc, order) => {
      return acc + calculateOrderPreparingWeight(order);
    }, 0);

    dailyBreakdown.push({
      date: format(date, 'MMM dd'),
      fullDate: dateIST,
      orders: dayOrders.length,
      completedOrders: dayCompletedOrders.length,
      revenue: dayRevenue,
      weight: dayWeight
    });
  }

  // Monthly report calculations
  const monthlyCompletedOrders = monthlyOrders.filter(o => ['completed', 'prepared'].includes(o.status));
  const monthlyDeclinedOrders = monthlyOrders.filter(o => o.status === 'rejected' || o.rejectionReason);
  const monthlyRevenue = monthlyCompletedOrders.reduce((acc, order) => acc + calculateOrderRevenueAnalytics(order), 0);
  const monthlyWeightSold = monthlyCompletedOrders.reduce((acc, order) => {
    return acc + calculateOrderPreparingWeight(order);
  }, 0);

  // Weekly breakdown for the month
  const weeklyBreakdown = [];
  const currentDate = new Date(monthStart);
  let weekNumber = 1;
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
    const weekRevenue = weekCompletedOrders.reduce((acc, order) => acc + calculateOrderRevenueAnalytics(order), 0);
    const weekWeight = weekCompletedOrders.reduce((acc, order) => {
      return acc + calculateOrderPreparingWeight(order);
    }, 0);

    weeklyBreakdown.push({
      week: `Week ${weekNumber}`,
      dateRange: `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`,
      fullDate: getISTDateString(weekStart),
      orders: weekOrders.length,
      completedOrders: weekCompletedOrders.length,
      revenue: weekRevenue,
      weight: weekWeight
    });

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
    weekNumber++;
  }

  // ✅ FIX: Use deduplicated orders for chart data
  const chartData = deduplicatedTodayOrders.map((order, index) => ({
    id: `${order.id}-${index}`, // ✅ FIX: Add index to ensure unique keys
    revenue: (order.status === 'rejected' || order.rejectionReason) ? -calculateOrderRevenueAnalytics(order) : calculateOrderRevenueAnalytics(order),
  }));

  // Calculate item-wise statistics for today only
  // completedOrders is already filtered to today's orders
  // Use actual preparing weights for each item instead of proportional distribution
  const itemStats = completedOrders.reduce((acc, order) => {
    const orderRevenue = calculateOrderRevenueAnalytics(order);
    
    order.items.forEach((item) => {
      // Skip rejected items
      if ((item as any).rejected) {
        return;
      }
      
      if (!acc[item.name]) {
        acc[item.name] = { totalWeight: 0, totalRevenue: 0, count: 0 };
      }
      
      // Get actual preparing weight for this specific item
      const itemPreparingWeight = getItemPreparingWeight(order, item.name);
      
      // Calculate item revenue from order.itemRevenues if available
      // Revenue is stored with key format: "itemName_size" (e.g., "black pomfret_small")
      let itemRevenue = 0;
      if (order.itemRevenues) {
        const itemSize = item.size || 'default';
        const itemKey = `${item.name}_${itemSize}`;
        // Try the full key first (itemName_size)
        if (order.itemRevenues[itemKey] !== undefined) {
          itemRevenue = order.itemRevenues[itemKey];
        } else if (order.itemRevenues[item.name] !== undefined) {
          // Fallback: Try just item name (for backward compatibility)
          itemRevenue = order.itemRevenues[item.name];
        } else {
          // If no item-specific revenue, distribute proportionally based on preparing weights
          const totalOrderWeight = calculateOrderPreparingWeight(order);
          if (totalOrderWeight > 0) {
            const itemProportion = itemPreparingWeight / totalOrderWeight;
            itemRevenue = orderRevenue * itemProportion;
          }
        }
      } else {
        // If no itemRevenues, distribute proportionally based on preparing weights
        const totalOrderWeight = calculateOrderPreparingWeight(order);
        if (totalOrderWeight > 0) {
          const itemProportion = itemPreparingWeight / totalOrderWeight;
          itemRevenue = orderRevenue * itemProportion;
        }
      }
      
      acc[item.name].totalWeight += itemPreparingWeight;
      acc[item.name].totalRevenue += itemRevenue;
      acc[item.name].count += 1;
    });
    return acc;
  }, {} as Record<string, { totalWeight: number; totalRevenue: number; count: number }>);

  // Use totalWeightSold as dailyWeightSold (they're the same for today's orders)
  const dailyWeightSold = totalWeightSold;

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
  };

  const getPrepTime = (order: Order) => {
    const startTime = toDate(order.preparationStartTime);
    const endTime = toDate(order.preparationEndTime);
    if (startTime && endTime) {
      const diff = endTime.getTime() - startTime.getTime();
      return `${Math.floor(diff / (1000 * 60))}m ${Math.floor((diff / 1000) % 60)}s`;
    }
    return 'N/A';
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {/* ✅ FIX: Make analytics tabs responsive like admin tabs */}
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="w-full max-w-full overflow-x-auto flex sm:grid sm:grid-cols-3 gap-1 sm:gap-2 p-1 sm:p-1 h-auto sm:h-10 px-1 sm:px-1">
          <TabsTrigger value="today" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4">
            <Calendar className="h-4 w-4" />
            <span>Today</span>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4">
            <FileText className="h-4 w-4" />
            <span>Weekly</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4">
            <TrendingUp className="h-4 w-4" />
            <span>Monthly</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Today Tab */}
        <TabsContent value="today" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
        {/* ✅ FIX: Responsive header matching order page */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Analytics Dashboard</h1>
            {isAdmin && <p className="text-sm sm:text-base text-muted-foreground mt-1">Admin view - All butchers data</p>}
          </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="text-xs sm:text-sm">
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
          {error && (
            <div className="flex items-center gap-2 text-destructive text-xs sm:text-sm">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Daily Analytics Section */}
      <div className="space-y-4 sm:space-y-6">
        <Card className="border-primary bg-primary/5 w-full max-w-full">
          <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
            <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-primary text-base sm:text-lg md:text-xl">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span>Today's Performance</span>
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">({format(new Date(), 'MMM dd')})</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Real-time overview of today's sales and operations
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
            <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Total Revenue</p>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  {deduplicatedTodayOrders.length}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Total Orders</p>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  {completedOrders.length}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Completed Orders</p>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  {dailyWeightSold.toFixed(2)} kg
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Total Weight Sold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Orders Table */}
        <Card className="w-full max-w-full">
          <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl">Today's Orders</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">A detailed list of all orders processed today.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
            {/* ✅ FIX: Scrollable table container for mobile */}
            <div className="w-full overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6">
              <div className="min-w-[600px] px-3 sm:px-4 lg:px-6">
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
                  {deduplicatedTodayOrders.length > 0 ? deduplicatedTodayOrders.map((order, index) => (
                    <TableRow key={`${order.id}-${index}`}>
                      <TableCell className="font-medium">{getDisplayOrderId(order.id)}</TableCell>
                      <TableCell>{getStatusBadge(order)}</TableCell>
                      <TableCell>{getPrepTime(order)}</TableCell>
                      <TableCell className="text-right">
                        ₹{calculateOrderRevenueAnalytics(order).toLocaleString('en-IN')}
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
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="w-full max-w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue Today</CardTitle>
              <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold">₹{completedOrders.reduce((acc, order) => acc + calculateOrderRevenueAnalytics(order), 0).toLocaleString('en-IN')}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">From {completedOrders.length} completed orders today {declinedOrders.length > 0 && `(${declinedOrders.length} declined shown separately)`}</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="w-full max-w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Orders Today</CardTitle>
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-28" />
                </>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold">{deduplicatedTodayOrders.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{completedOrders.length} completed today</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="w-full max-w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Weight Sold Today</CardTitle>
              <Weight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold">{dailyWeightSold.toFixed(2)} kg</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Across all items today</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="w-full max-w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Avg. Preparation Time</CardTitle>
              <Timer className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-18 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold">{avgPrepTimeInMinutes.toFixed(1)} min</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Across all completed orders</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Declined Orders Card - Show separately */}
        {declinedOrders.length > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 w-full max-w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-300">Declined Orders Today</CardTitle>
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
                -₹{declinedOrders.reduce((acc, order) => acc + calculateOrderRevenueAnalytics(order), 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 mt-1">
                Lost revenue from {declinedOrders.length} declined orders (not included in total)
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          <Card className="w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Today's Revenue by Order</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">A summary of revenue generated from each order today.</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 lg:px-6 pb-4 sm:pb-6">
              {/* ✅ FIX: Scrollable chart container */}
              <div className="w-full overflow-x-auto -mx-2 sm:-mx-4 lg:-mx-6">
                <div className="min-w-[400px] px-2 sm:px-4 lg:px-6">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Item-wise Statistics */}
        <Card className="w-full max-w-full">
          <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl">Item-wise Sales Today</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">Weight sold and revenue generated for each item today.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
            {/* ✅ FIX: Scrollable table container for mobile */}
            <div className="w-full overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6">
              <div className="min-w-[600px] px-3 sm:px-4 lg:px-6">
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
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        {/* Weekly Tab */}
        <TabsContent value="weekly" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="space-y-6">
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-blue-700 dark:text-blue-300 text-base sm:text-lg md:text-xl">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span>Weekly Report</span>
                </span>
                <span className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">({format(monday, 'MMM dd')} - {format(sunday, 'MMM dd')})</span>
              </CardTitle>
              <CardDescription className="text-blue-600 dark:text-blue-400 text-xs sm:text-sm mt-1">
                Summary of the past 7 days performance
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
              <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                    ₹{weeklyRevenue.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-1">Total Revenue</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {weeklyOrders.length}
                  </div>
                  <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-1">Total Orders</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {weeklyCompletedOrders.length}
                  </div>
                  <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-1">Completed Orders</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {weeklyWeightSold.toFixed(2)} kg
                  </div>
                  <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-1">Total Weight Sold</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown Chart */}
          <Card className="w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Daily Performance Breakdown</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">Revenue and orders for each day of the week</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
              {/* ✅ FIX: Scrollable chart container */}
              <div className="w-full overflow-x-auto -mx-2 sm:-mx-4 lg:-mx-6">
                <div className="min-w-[400px] px-2 sm:px-4 lg:px-6">
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown Table */}
          <Card className="w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Daily Breakdown Details</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">Detailed statistics for each day of the week</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
              {/* ✅ FIX: Scrollable table container for mobile */}
              <div className="w-full overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6">
                <div className="min-w-[600px] px-3 sm:px-4 lg:px-6">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-green-700 dark:text-green-300 text-base sm:text-lg md:text-xl">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span>Monthly Report</span>
                </span>
                <span className="text-xs sm:text-sm text-green-600 dark:text-green-400">({format(monthStart, 'MMM dd')} - {format(monthEnd, 'MMM dd')})</span>
              </CardTitle>
              <CardDescription className="text-green-600 dark:text-green-400 text-xs sm:text-sm mt-1">
                Summary of the current month's performance
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
              <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                    ₹{monthlyRevenue.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-1">Total Revenue</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                    {monthlyOrders.length}
                  </div>
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-1">Total Orders</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                    {monthlyCompletedOrders.length}
                  </div>
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-1">Completed Orders</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                    {monthlyWeightSold.toFixed(2)} kg
                  </div>
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-1">Total Weight Sold</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Breakdown Chart for Month */}
          <Card className="w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Weekly Performance Breakdown</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">Revenue and orders for each week of the month</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
              {/* ✅ FIX: Scrollable chart container */}
              <div className="w-full overflow-x-auto -mx-2 sm:-mx-4 lg:-mx-6">
                <div className="min-w-[400px] px-2 sm:px-4 lg:px-6">
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Breakdown Table for Month */}
          <Card className="w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-3 sm:px-4 lg:px-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Weekly Breakdown Details</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">Detailed statistics for each week of the month</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
              {/* ✅ FIX: Scrollable table container for mobile */}
              <div className="w-full overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6">
                <div className="min-w-[700px] px-3 sm:px-4 lg:px-6">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>
      </Tabs>

    </div>
  )
}
