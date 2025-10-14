"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Skeleton } from "../../components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Textarea } from "../../components/ui/textarea"
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog"
import { useToast } from "../../hooks/use-toast"
import { useAuth } from "../../context/AuthContext"
import type { Order } from "../../lib/types"
import { 
  IndianRupee, 
  ShoppingCart, 
  Timer, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Weight, 
  RefreshCw, 
  AlertCircle, 
  Calendar, 
  FileText, 
  Users, 
  BarChart3, 
  MessageSquare, 
  Package,
  Settings,
  Bell,
  LogOut,
  Trash2,
  Target,
  Activity
} from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "../../components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Area, AreaChart, ResponsiveContainer } from "recharts"
import { format } from "date-fns"
import { useState, useEffect, useCallback } from "react"
import { useOrderPolling } from "../../hooks/useOrderPolling"
import { useClientCache } from "../../hooks/useClientCache"
import { freshButchers } from "../../lib/freshMockData"
import { CommissionMarkupSettings } from "../../components/admin/CommissionMarkupSettings"
import { OrdersAnalytics } from "../../components/admin/OrdersAnalytics"
import DAMAnalysis from "../../components/admin/DAMAnalysis"
import { RateLimitMonitor } from "../../components/admin/RateLimitMonitor"

// Helper function to extract order number from full order ID for display
const getDisplayOrderId = (orderId: string): string => {
  const orderIdParts = orderId.replace('ORD-', '').split('-');
  const orderNumber = orderIdParts[orderIdParts.length - 1];
  return `ORD-${orderNumber}`;
};

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
  orders: {
    label: "Orders",
    color: "hsl(var(--secondary))",
  },
} satisfies ChartConfig

export default function AdminPage() {
  const { admin, isAdmin, logout } = useAuth();
  const { toast } = useToast();
  const { clear: clearCache } = useClientCache();
  
  // State management
  const [selectedButcher, setSelectedButcher] = useState<string>('all');
  const [timeFrame, setTimeFrame] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [supportRequests, setSupportRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastSupportUpdate, setLastSupportUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      window.location.href = '/';
    }
  }, [isAdmin]);

  // Fetch orders for all butchers
  const fetchAllOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const butcherIds = freshButchers.map(b => b.id);
      const orderPromises = butcherIds.map(async (butcherId) => {
        try {
          const response = await fetch(`/api/orders/${butcherId}`);
          if (response.ok) {
            const responseData = await response.json();
            // The API returns { orders: [...] }, so we need to extract the orders array
            const orders = responseData.orders || responseData;
            // Ensure orders is an array before mapping
            if (Array.isArray(orders)) {
              return orders.map((order: Order) => ({
                ...order,
                butcherId,
                butcherName: freshButchers.find(b => b.id === butcherId)?.name || butcherId
              }));
            } else {
              return [];
            }
          }
          return [];
        } catch (error) {
          return [];
        }
      });
      
      const allOrdersResults = await Promise.all(orderPromises);
      // Ensure all results are arrays before flattening
      const validResults = allOrdersResults.filter(Array.isArray);
      const flatOrders = validResults.flat();
      setAllOrders(flatOrders);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch orders data.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch support requests
  const fetchSupportRequests = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }
      
      const response = await fetch('/api/contact');
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setSupportRequests(data.requests || []);
          setLastSupportUpdate(new Date());
          
          if (isManualRefresh) {
            toast({
              title: "Refreshed",
              description: "Support requests have been updated.",
            });
          }
        } else {
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
      }
    } catch (error) {
    } finally {
      if (isManualRefresh) {
        setIsRefreshing(false);
      }
    }
  }, [toast]);

  const handleManualRefresh = () => {
    fetchSupportRequests(true);
    fetchNotifications();
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnreadNotifications(data.unreadCount || 0);
        } else {
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
      }
    } catch (error) {
    }
  }, []);

  // Mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationId,
          read: true
        }),
      });
      
      if (response.ok) {
        fetchNotifications(); // Refresh notifications
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`Failed to mark notification as read: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Handle admin response to support request
  const handleAdminResponse = async (requestId: string, status: string) => {
    setIsResponding(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          status,
          adminResponse: adminResponse.trim() || null
        }),
      });

      if (response.ok) {
        toast({
          title: "Response Sent",
          description: "Your response has been sent to the butcher.",
        });
        setAdminResponse('');
        setSelectedRequest(null);
        fetchSupportRequests(); // Refresh the list
      } else {
        throw new Error('Failed to send response');
      }
    } catch (error) {
      console.error('Error sending admin response:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send response. Please try again.",
      });
    } finally {
      setIsResponding(false);
    }
  };

  // Handle delete click
  const handleDeleteClick = (requestId: string) => {
    setRequestToDelete(requestId);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!requestToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/contact?requestId=${requestToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Request Deleted",
          description: "Support request has been deleted successfully.",
        });
        
        // Immediately remove from local state for instant UI update
        setSupportRequests(prev => prev.filter(req => req.id !== requestToDelete));
        
        // Close the dialog
        setDeleteDialogOpen(false);
        setRequestToDelete(null);
        
        // Then refresh from server to ensure consistency
        setTimeout(() => {
          fetchSupportRequests();
        }, 500);
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete support request');
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Failed to delete support request: ${response.status} ${errorText}`);
        }
      }
    } catch (error) {
      console.error('Error deleting support request:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete support request. Please try again.",
      });
    } finally {
      setIsDeleting(false);
      setRequestToDelete(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAllOrders();
      fetchSupportRequests();
      fetchNotifications();
    }
  }, [isAdmin]); // Remove function dependencies to prevent infinite loop

  // Poll for support requests and notifications updates every 30 seconds
  useEffect(() => {
    if (!isAdmin || !pollingEnabled) return;

    const interval = setInterval(() => {
      fetchSupportRequests();
      fetchNotifications();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [isAdmin, pollingEnabled]); // Keep these dependencies as they're stable

  // Filter orders based on selected butcher and time frame
  const getFilteredOrders = () => {
    let filtered = allOrders;
    
    // Filter by butcher
    if (selectedButcher !== 'all') {
      filtered = filtered.filter(order => order.butcherId === selectedButcher);
    }
    
    // Filter by time frame
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeFrame) {
      case 'daily':
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.orderTime);
          // Set time to start of day for accurate comparison
          const orderDateStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return orderDateStart.getTime() === todayStart.getTime();
        });
        break;
      case 'weekly':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.orderTime);
          return orderDate >= weekAgo;
        });
        break;
      case 'monthly':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.orderTime);
          return orderDate >= monthAgo;
        });
        break;
      case 'custom':
        const startDate = new Date(customDateRange.start);
        const endDate = new Date(customDateRange.end);
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.orderTime);
          return orderDate >= startDate && orderDate <= endDate;
        });
        break;
    }
    
    return filtered;
  };

  const filteredOrders = getFilteredOrders();
  const completedOrders = filteredOrders.filter(o => ['completed', 'prepared', 'ready to pick up'].includes(o.status));
  const declinedOrders = filteredOrders.filter(o => o.status === 'rejected' || o.rejectionReason);
  const preparingOrders = filteredOrders.filter(o => o.status === 'preparing');

  // Calculate analytics
  const totalRevenue = completedOrders.reduce((acc, order) => acc + (order.revenue || 0), 0);
  const totalOrders = filteredOrders.length;
  const completionRate = totalOrders > 0 ? (completedOrders.length / totalOrders) * 100 : 0;
  const avgPrepTime = completedOrders.reduce((acc, order) => {
    if (order.preparationStartTime && order.preparationEndTime) {
      const start = new Date(order.preparationStartTime);
      const end = new Date(order.preparationEndTime);
      return acc + (end.getTime() - start.getTime()) / (1000 * 60); // minutes
    }
    return acc;
  }, 0) / completedOrders.length || 0;

  // Butcher performance data
  const butcherPerformance = freshButchers.map(butcher => {
    const butcherOrders = filteredOrders.filter(o => o.butcherId === butcher.id);
    const completed = butcherOrders.filter(o => ['completed', 'prepared'].includes(o.status));
    const revenue = completed.reduce((acc, order) => acc + (order.revenue || 0), 0);
    
    return {
      id: butcher.id,
      name: butcher.name,
      totalOrders: butcherOrders.length,
      completedOrders: completed.length,
      revenue,
      completionRate: butcherOrders.length > 0 ? (completed.length / butcherOrders.length) * 100 : 0
    };
  });

  // Chart data
  const revenueChartData = butcherPerformance.map(butcher => ({
    name: butcher.name,
    revenue: butcher.revenue,
    orders: butcher.totalOrders
  }));

  // Calculate item-wise statistics for today only
  const todayCompletedOrders = completedOrders.filter(order => {
    const orderDate = new Date(order.orderTime);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const itemStats = todayCompletedOrders.reduce((acc, order) => {
    const orderRevenue = order.revenue || 0;
    const orderWeight = order.pickedWeight || order.items.reduce((sum, item) => sum + item.quantity, 0);
    
    order.items.forEach((item) => {
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

  // Sort items by revenue (highest first)
  const sortedItemStats = Object.entries(itemStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Monitor all butchers and system performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleManualRefresh} disabled={isRefreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Support'}
          </Button>
          <Button onClick={fetchAllOrders} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Orders
          </Button>
          <Button
            variant={pollingEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setPollingEnabled(!pollingEnabled)}
          >
            {pollingEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button onClick={logout} variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="butchers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Butchers
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="dam-analysis" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            D.A.M Analysis
          </TabsTrigger>
          <TabsTrigger value="rate-monitor" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Rate Monitor
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
            {unreadNotifications > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                {unreadNotifications}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Support
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Time Frame Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Time Frame Selection</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <Label>Time Frame</Label>
                  <Select value={timeFrame} onValueChange={(value: any) => setTimeFrame(value)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {timeFrame === 'custom' && (
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

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground">
                  {timeFrame} revenue from {selectedButcher === 'all' ? 'all butchers' : freshButchers.find(b => b.id === selectedButcher)?.name}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {completedOrders.length} completed, {declinedOrders.length} declined
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Orders completed successfully
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Prep Time</CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgPrepTime.toFixed(1)} min</div>
                <p className="text-xs text-muted-foreground">
                  Average preparation time
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Butcher</CardTitle>
                <CardDescription>Revenue distribution across butchers</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Revenue distribution by butcher over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <AreaChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `₹${value}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Butchers Tab */}
        <TabsContent value="butchers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Butcher Performance</CardTitle>
              <CardDescription>Individual butcher performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Butcher</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Completion Rate</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {butcherPerformance.map((butcher) => (
                    <TableRow key={butcher.id}>
                      <TableCell className="font-medium">{butcher.name}</TableCell>
                      <TableCell>{butcher.totalOrders}</TableCell>
                      <TableCell>{butcher.completedOrders}</TableCell>
                      <TableCell>
                        <Badge variant={butcher.completionRate >= 80 ? "default" : butcher.completionRate >= 60 ? "secondary" : "destructive"}>
                          {butcher.completionRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">₹{butcher.revenue.toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <OrdersAnalytics />
        </TabsContent>

        {/* D.A.M Analysis Tab */}
        <TabsContent value="dam-analysis" className="space-y-6">
          <DAMAnalysis />
        </TabsContent>

        {/* Rate Monitor Tab */}
        <TabsContent value="rate-monitor" className="space-y-6">
          <RateLimitMonitor />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Notifications</h2>
              <p className="text-muted-foreground">System notifications and alerts</p>
            </div>
            <Button onClick={fetchNotifications} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {notifications.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No notifications found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {notifications.map((notification) => (
                <Card 
                  key={notification.id} 
                  className={`cursor-pointer transition-colors ${!notification.read ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20' : 'border-gray-200 bg-gray-50 dark:bg-gray-950/20'}`}
                  onClick={() => !notification.read && markNotificationAsRead(notification.id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {notification.type === 'order_declined' ? (
                            <>
                              <XCircle className="h-5 w-5 text-red-500" />
                              Order Declined
                            </>
                          ) : (
                            <>
                              <Bell className="h-5 w-5" />
                              System Notification
                            </>
                          )}
                        </CardTitle>
                        <CardDescription>
                          From: {notification.butcherName} • {format(new Date(notification.createdAt), 'MMM dd, yyyy HH:mm')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                        )}
                        <Badge variant={notification.type === 'order_declined' ? 'destructive' : 'secondary'}>
                          {notification.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {notification.orderNumber && (
                      <div>
                        <Label className="text-sm font-medium">Order:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{notification.orderNumber}</p>
                      </div>
                    )}
                    
                    {notification.reason && (
                      <div>
                        <Label className="text-sm font-medium">Reason:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{notification.reason}</p>
                      </div>
                    )}

                    {notification.data && notification.data.potentialRevenue && (
                      <div>
                        <Label className="text-sm font-medium">Lost Revenue:</Label>
                        <p className="text-sm text-red-600 font-medium mt-1">
                          ₹{notification.data.potentialRevenue.toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}

                    {notification.data && notification.data.items && (
                      <div>
                        <Label className="text-sm font-medium">Items:</Label>
                        <div className="mt-1 space-y-1">
                          {notification.data.items.map((item: any, index: number) => (
                            <p key={index} className="text-sm text-muted-foreground">
                              • {item.name} ({item.quantity}kg)
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Support Requests</h2>
              <div className="text-muted-foreground">
                <p>Manage butcher support requests and packing orders</p>
                <div className="flex items-center gap-4 mt-1">
                  {lastSupportUpdate && (
                    <span className="text-xs text-muted-foreground">
                      Last updated: {lastSupportUpdate.toLocaleTimeString()}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Auto-refresh: {pollingEnabled ? 'Every 30s' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
            <Button onClick={handleManualRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {supportRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No support requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {supportRequests.map((request) => (
                <Card key={request.id} className={`${request.status === 'pending' ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20' : 'border-green-200 bg-green-50 dark:bg-green-950/20'}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {request.type === 'packing_request' ? (
                            <div className="flex items-center gap-2">
                              <Package className="h-5 w-5" />
                              Packing Request
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-5 w-5" />
                              General Contact
                            </div>
                          )}
                        </CardTitle>
                        <CardDescription>
                          From: {request.butcherName} • {format(new Date(request.createdAt), 'MMM dd, yyyy HH:mm')}
                        </CardDescription>
                      </div>
                      <Badge variant={request.status === 'pending' ? 'secondary' : 'default'}>
                        {request.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {request.message && (
                      <div>
                        <Label className="text-sm font-medium">Message:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                      </div>
                    )}
                    
                    {request.packingRequests && (
                      <div>
                        <Label className="text-sm font-medium">Packing Request:</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                          {Object.entries(request.packingRequests).map(([size, count]) => {
                            const numCount = count as number;
                            return numCount > 0 && (
                              <div key={size} className="flex justify-between items-center p-2 bg-background rounded border">
                                <span className="text-sm">{size} bags</span>
                                <Badge variant="outline">{numCount}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {request.adminResponse && (
                      <div>
                        <Label className="text-sm font-medium">Admin Response:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{request.adminResponse}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4 border-t">
                      {request.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            Respond
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAdminResponse(request.id, 'resolved')}
                          >
                            Mark Resolved
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(request.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Response Modal */}
          {selectedRequest && (
            <Card className="fixed inset-4 z-50 bg-background border shadow-lg">
              <CardHeader>
                <CardTitle>Respond to Support Request</CardTitle>
                <CardDescription>
                  Responding to {selectedRequest.butcherName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-response">Your Response</Label>
                  <Textarea
                    id="admin-response"
                    placeholder="Type your response here..."
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedRequest(null);
                      setAdminResponse('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleAdminResponse(selectedRequest.id, 'responded')}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Response'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <CommissionMarkupSettings />
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Support Request"
        description="Are you sure you want to delete this support request? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  )
}
