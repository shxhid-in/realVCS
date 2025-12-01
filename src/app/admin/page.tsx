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
import { useState, useEffect, useCallback, useRef } from "react"
import { useOrderCache } from "../../hooks/useOrderCache"
import { useClientCache } from "../../hooks/useClientCache"
import { freshButchers } from "../../lib/freshMockData"
import { CommissionMarkupSettings } from "../../components/admin/CommissionMarkupSettings"
import { OrdersAnalytics } from "../../components/admin/OrdersAnalytics"
import DAMAnalysis from "../../components/admin/DAMAnalysis"
import { RateLimitMonitor } from "../../components/admin/RateLimitMonitor"
import { ThemeToggle } from "../../components/ThemeToggle"

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const tabsListRef = useRef<HTMLDivElement>(null);

  // Redirect if not admin (with proper loading check)
  useEffect(() => {
    // Don't redirect if auth is still loading
    if (admin === undefined && !isAdmin) {
      return;
    }
    
    // Only redirect if we're sure the user is not an admin
    if (!isAdmin && admin === null) {
      window.location.href = '/';
    }
  }, [isAdmin, admin]);

  // Ensure tabs start from the beginning (scroll to left on mount and after render)
  useEffect(() => {
    const scrollToStart = () => {
      if (tabsListRef.current) {
        // Use both scrollLeft and scrollTo for maximum compatibility
        tabsListRef.current.scrollLeft = 0;
        tabsListRef.current.scrollTo({ left: 0, behavior: 'auto' });
      }
    };
    
    // Multiple attempts to ensure scroll happens after DOM is ready
    scrollToStart();
    
    // Use requestAnimationFrame for next frame
    requestAnimationFrame(() => {
      scrollToStart();
      // Also try after a short delay
      setTimeout(scrollToStart, 50);
      setTimeout(scrollToStart, 150);
      setTimeout(scrollToStart, 300);
    });
    
    // Scroll on window resize (mobile orientation changes, etc.)
    window.addEventListener('resize', scrollToStart);
    
    // Also listen for scroll events to prevent drift
    const handleScroll = () => {
      if (tabsListRef.current && tabsListRef.current.scrollLeft < 0) {
        scrollToStart();
      }
    };
    
    if (tabsListRef.current) {
      tabsListRef.current.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      window.removeEventListener('resize', scrollToStart);
      if (tabsListRef.current) {
        tabsListRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Helper function to delay between API calls (rate limiting)
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Fetch orders for all butchers from sheets (not cache) with rate limiting
  const fetchAllOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const butcherIds = freshButchers.map(b => b.id);
      const allOrdersData: Order[] = [];

      // Rate limiting: Add delay between requests to avoid quota errors
      // Google Sheets API limit: 100 requests per minute per user
      // We'll add 600ms delay between requests = ~100 requests per minute max
      const DELAY_BETWEEN_REQUESTS = 600; // 600ms = ~100 requests/minute

      // Fetch all orders from sheets for each butcher (with pagination and rate limiting)
      for (let i = 0; i < butcherIds.length; i++) {
        const butcherId = butcherIds[i];
        try {
          let page = 1;
          let hasMore = true;

          // Fetch all pages sequentially with rate limiting
          while (hasMore) {
            // Add delay before each request (except the first one)
            if (page > 1 || i > 0) {
              await delay(DELAY_BETWEEN_REQUESTS);
            }

            const response = await fetch(`/api/analytics/${butcherId}?page=${page}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.message || errorData.error || 'Failed to fetch analytics data';
              
              // Check for quota errors
              if (response.status === 429 || errorMessage.includes('Quota exceeded') || errorMessage.includes('quota')) {
                const quotaError = 'Google Sheets API quota exceeded. Please wait a minute and try again.';
                setError(quotaError);
                toast({
                  variant: "destructive",
                  title: "Rate Limit Exceeded",
                  description: quotaError,
                });
                // Stop fetching and return what we have so far
                setAllOrders(allOrdersData);
                setIsLoading(false);
                return;
              }
              
              throw new Error(errorMessage);
            }

            const data = await response.json();
            const orders = (data.orders || []).map((order: Order) => ({
              ...order,
              butcherId,
              butcherName: freshButchers.find(b => b.id === butcherId)?.name || butcherId
            }));
            
            allOrdersData.push(...orders);
            
            hasMore = data.pagination?.hasMore || false;
            page++;
          }
        } catch (error: any) {
          console.error(`Error fetching orders for ${butcherId}:`, error);
          
          // If it's a quota error, stop and show error
          if (error.message?.includes('Quota exceeded') || error.message?.includes('quota')) {
            const quotaError = 'Google Sheets API quota exceeded. Please wait a minute and try again.';
            setError(quotaError);
            toast({
              variant: "destructive",
              title: "Rate Limit Exceeded",
              description: quotaError,
            });
            setAllOrders(allOrdersData);
            setIsLoading(false);
            return;
          }
          
          // Continue with other butchers even if one fails (non-quota errors)
        }
      }

      setAllOrders(allOrdersData);
      
      if (allOrdersData.length > 0) {
        toast({
          title: "Data Loaded",
          description: `Loaded ${allOrdersData.length} orders from sheets.`,
        });
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      const errorMessage = error.message || "Failed to fetch orders data from sheets.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
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
    <div className="min-h-screen bg-background">
      {/* ✅ FIX: Add proper container with margins and responsive padding - prevent horizontal overflow */}
      <div className="w-full max-w-full overflow-x-hidden px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* ✅ FIX: Responsive header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">Monitor all butchers and system performance</p>
            </div>
            {/* ✅ FIX: Responsive button group */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <ThemeToggle />
              <Button onClick={logout} variant="outline" size="sm" className="text-xs sm:text-sm">
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList 
              ref={tabsListRef} 
              className="w-full overflow-x-auto flex sm:grid sm:grid-cols-8 gap-1 sm:gap-2 p-1 sm:p-1 h-auto sm:h-10 px-0 sm:px-1 scrollbar-hide justify-start"
              style={{ scrollBehavior: 'smooth' }}
            >
              <TabsTrigger value="overview" className="flex items-center gap-2 whitespace-nowrap pl-4 pr-3 sm:px-4 flex-shrink-0 min-w-fit">
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="butchers" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>Butchers</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span>Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="dam-analysis" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
                <Target className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">D.A.M Analysis</span>
                <span className="sm:hidden">D.A.M</span>
              </TabsTrigger>
              <TabsTrigger value="rate-monitor" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
                <Activity className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Rate Monitor</span>
                <span className="sm:hidden">Rates</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit relative">
                <Bell className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Notifications</span>
                <span className="sm:hidden">Alerts</span>
                {unreadNotifications > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center absolute -top-1 -right-1">
                    {unreadNotifications}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="support" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span>Support</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 whitespace-nowrap pl-3 pr-4 sm:px-4 flex-shrink-0 min-w-fit">
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          {/* Time Frame Selector */}
          <Card className="w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg sm:text-xl">Time Frame Selection</CardTitle>
                <Button onClick={fetchAllOrders} disabled={isLoading} variant="outline" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Refreshing...' : 'Refresh Orders'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
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
            <Card className="w-full max-w-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString('en-IN')}</div>
                    <p className="text-xs text-muted-foreground">
                      {timeFrame} revenue from {selectedButcher === 'all' ? 'all butchers' : freshButchers.find(b => b.id === selectedButcher)?.name}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="w-full max-w-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-40" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{totalOrders}</div>
                    <p className="text-xs text-muted-foreground">
                      {completedOrders.length} completed, {declinedOrders.length} declined
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="w-full max-w-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                      Orders completed successfully
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="w-full max-w-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-sm font-medium">Avg. Prep Time</CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-4 w-36" />
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{avgPrepTime.toFixed(1)} min</div>
                    <p className="text-xs text-muted-foreground">
                      Average preparation time
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts with internal horizontal scroll on mobile */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl">Revenue by Butcher</CardTitle>
                <CardDescription className="text-sm mt-1">Revenue distribution across butchers</CardDescription>
              </CardHeader>
              <CardContent className="px-0 sm:px-4 lg:px-6 pb-4 sm:pb-6">
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : revenueChartData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No revenue data available</p>
                      <p className="text-sm text-muted-foreground mt-2">Click "Refresh Orders" to load data</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto scrollbar-hide">
                    <div className="min-w-[600px] px-4 sm:px-6">
                      <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <BarChart data={revenueChartData}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} />
                          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl">Revenue Trend</CardTitle>
                <CardDescription className="text-sm mt-1">Revenue distribution by butcher over time</CardDescription>
              </CardHeader>
              <CardContent className="px-0 sm:px-4 lg:px-6 pb-4 sm:pb-6">
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : revenueChartData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No revenue data available</p>
                      <p className="text-sm text-muted-foreground mt-2">Click "Refresh Orders" to load data</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto scrollbar-hide">
                    <div className="min-w-[600px] px-4 sm:px-6">
                      <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <AreaChart data={revenueChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
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
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Butchers Tab */}
            <TabsContent value="butchers" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <Card className="w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg sm:text-xl">Butcher Performance</CardTitle>
                  <CardDescription className="text-sm mt-1">Individual butcher performance metrics</CardDescription>
                </div>
                <Button onClick={fetchAllOrders} disabled={isLoading} variant="outline" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Refreshing...' : 'Refresh Orders'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : butcherPerformance.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No butcher performance data available</p>
                  <p className="text-sm text-muted-foreground mt-2">Click "Refresh Orders" to load data</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto -mx-4 sm:-mx-6 scrollbar-hide">
                  <div className="min-w-[600px] px-4 sm:px-6">
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
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <OrdersAnalytics 
            allOrders={allOrders} 
            onRefresh={fetchAllOrders}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* D.A.M Analysis Tab */}
            <TabsContent value="dam-analysis" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <DAMAnalysis 
            allOrders={allOrders} 
            onRefresh={fetchAllOrders}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Rate Monitor Tab */}
            <TabsContent value="rate-monitor" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <RateLimitMonitor />
        </TabsContent>

        {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
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
            <TabsContent value="support" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
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
                    
                    {request.packingRequests && Array.isArray(request.packingRequests) && request.packingRequests.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Packing Request:</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                          {request.packingRequests.map((size: string) => (
                            <div key={size} className="flex items-center justify-between p-2 bg-background rounded border">
                              <div className="flex items-center gap-2">
                                <span className="text-green-600 font-bold">✓</span>
                                <span className="text-sm">{size}</span>
                              </div>
                              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
                                Selected
                              </Badge>
                            </div>
                          ))}
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
            <TabsContent value="settings" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
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
      </div>
    </div>
  )
}
