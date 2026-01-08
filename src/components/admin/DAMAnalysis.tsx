'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  PieChart,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  IndianRupee,
  Lightbulb,
  TrendingDown,
  Activity,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Order } from '@/lib/types';
import { toDate } from '@/lib/utils';
import { getCommissionRate, extractEnglishName, findCategoryForItem, BUTCHER_CONFIGS } from '@/lib/butcherConfig';

interface WeeklyTarget {
  week: number;
  target: number;
  achieved: number;
  percentage: number;
  status: 'pending' | 'achieved' | 'missed';
}

interface ButcherTarget {
  butcherId: string;
  butcherName: string;
  target: number;
  achieved: number;
  percentage: number;
}

interface MonthlyTarget {
  month: string;
  year: number;
  totalTarget: number;
  weeklyTargets: WeeklyTarget[];
  totalAchieved: number;
  overallPercentage: number;
  butcherTargets?: ButcherTarget[];
  isButcherSpecific?: boolean;
}

interface SalesData {
  orderId: string;
  butcherId: string;
  butcherName: string;
  orderDate: string;
  items: string;
  quantity: string;
  size: string;
  cutType: string;
  preparingWeight: string;
  completionTime: string;
  startTime: string;
  status: string;
  salesRevenue: number;
  butcherRevenue: number;
  margin: number;
}

interface ButcherSalesSummary {
  butcherId: string;
  butcherName: string;
  totalSales: number;
  totalRevenue: number;
  totalMargin: number;
  orderCount: number;
}

interface DAMAnalysisProps {
  allOrders: Order[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Butcher list for targets
const BUTCHER_LIST = [
  { id: 'usaj', name: 'Usaj Meat Hub' },
  { id: 'usaj_mutton', name: 'Usaj Mutton Shop' },
  { id: 'pkd', name: 'PKD Stall' },
  { id: 'tender_chops', name: 'Tender Chops' },
  { id: 'kak', name: 'KAK' },
  { id: 'ka_sons', name: 'KA Sons' },
  { id: 'alif', name: 'Alif' },
  { id: 'test_fish', name: 'Test Fish' },
  { id: 'test_meat', name: 'Test Meat' },
];

const DAMAnalysis: React.FC<DAMAnalysisProps> = ({ allOrders = [], onRefresh, isLoading: externalIsLoading = false }) => {
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [butcherSummary, setButcherSummary] = useState<ButcherSalesSummary[]>([]);
  const [weeklyTargets, setWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [targetInput, setTargetInput] = useState('');
  const [enableButcherTargets, setEnableButcherTargets] = useState(false);
  const [butcherTargetInputs, setButcherTargetInputs] = useState<{ [butcherId: string]: string }>({});
  const tabsListRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const isLoadingRef = useRef(false);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    const scrollToStart = () => {
      if (tabsListRef.current) {
        tabsListRef.current.scrollLeft = 0;
        tabsListRef.current.scrollTo({ left: 0, behavior: 'auto' });
      }
    };
    
    scrollToStart();
    
    requestAnimationFrame(() => {
      scrollToStart();
      setTimeout(scrollToStart, 50);
      setTimeout(scrollToStart, 150);
      setTimeout(scrollToStart, 300);
    });
    
    window.addEventListener('resize', scrollToStart);
    
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

  const loadMonthlyTarget = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/dam-analysis/target?month=${selectedMonth}&year=${selectedYear}`);
      
      if (response.ok) {
        const data = await response.json();
        setMonthlyTarget(data);
        setTargetInput(data?.totalTarget?.toString() || '');
        
        // Set butcher-specific targets if they exist
        if (data?.isButcherSpecific && data?.butcherTargets) {
          setEnableButcherTargets(true);
          const inputs: { [butcherId: string]: string } = {};
          data.butcherTargets.forEach((bt: ButcherTarget) => {
            inputs[bt.butcherId] = bt.target.toString();
          });
          setButcherTargetInputs(inputs);
        } else {
          setEnableButcherTargets(false);
          setButcherTargetInputs({});
        }
      } else {
        setMonthlyTarget(null);
        setTargetInput('');
        setEnableButcherTargets(false);
        setButcherTargetInputs({});
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load monthly target data');
      }
    } catch (error: any) {
      setError(error.message || 'Try again later');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load monthly target data."
      });
    }
  }, [selectedMonth, selectedYear, toast]);

  const calculateSalesDataFromOrders = useCallback(() => {
    try {
      setError(null);
      
      const filteredOrders = allOrders.filter(order => {
        if (order.status !== 'completed') return false;
        
        const orderDate = new Date(order.orderTime);
        return orderDate.getMonth() + 1 === selectedMonth && orderDate.getFullYear() === selectedYear;
      });

      // Convert orders to SalesData format
      const calculatedSalesData: SalesData[] = filteredOrders.map(order => {
        const orderDate = new Date(order.orderTime);
        const orderDateStr = `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth() + 1).padStart(2, '0')}/${orderDate.getFullYear()}`;
        
        const orderIdParts = order.id.replace('ORD-', '').split('-');
        const orderNo = orderIdParts[orderIdParts.length - 1] || '';
        
        const items = order.items.map(item => item.name).join(', ');
        const quantities = order.items.map(item => `${item.quantity}${item.unit || 'kg'}`).join(', ');
        const sizes = order.items.map(item => item.size || 'default').join(', ');
        const cutTypes = order.items.map(item => item.cutType || '').join(', ');
        
        const isFishButcher = ['kak', 'ka_sons', 'alif','test_fish'].includes(order.butcherId || '');
        const preparingWeights = order.items.map(item => {
          const weight = isFishButcher 
            ? (order.itemWeights?.[item.name] || `${item.quantity}kg`)
            : (order.itemQuantities?.[item.name] || `${item.quantity}kg`);
          return `${item.name}: ${weight}`;
        }).join(', ');
        
        let completionTime = '';
        if (order.preparationStartTime && order.preparationEndTime) {
          const start = toDate(order.preparationStartTime);
          const end = toDate(order.preparationEndTime);
          if (start && end) {
          const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
          completionTime = diffMinutes <= 20 ? `${diffMinutes}min` : orderDateStr;
          }
        }
        
        const startTime = order.preparationStartTime 
          ? new Date(order.preparationStartTime).toLocaleString('en-GB', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }).replace(',', '')
          : '';
        
        const butcherRevenue = order.revenue || 0;
        let salesRevenue = 0;
        let hasValidCommissionRate = false;
        
        // Get butcher config to find the correct commission rates
        const butcherId = order.butcherId || '';
        const butcherConfig = BUTCHER_CONFIGS[butcherId];
        
        // Try to calculate sales revenue from itemRevenues
        if (order.itemRevenues && Object.keys(order.itemRevenues).length > 0) {
          order.items.forEach(item => {
            // Try different key formats: item.name, item.name_size, etc.
            const itemRevenue = order.itemRevenues![item.name] 
              || order.itemRevenues![`${item.name}_${item.size || 'default'}`]
              || 0;
            
            if (itemRevenue > 0) {
              // Find the correct category for this item using butcherConfig
              const categoryName = findCategoryForItem(butcherId, item.name) || item.category || '';
              const commissionRate = getCommissionRate(butcherId, categoryName);
              
              // Only calculate if we have a valid commission rate (> 0 and < 1)
              if (commissionRate > 0 && commissionRate < 1) {
                // Formula: salesRevenue = butcherRevenue / (1 - commissionRate)
                const itemSalesRevenue = itemRevenue / (1 - commissionRate);
              salesRevenue += itemSalesRevenue;
                hasValidCommissionRate = true;
              }
            }
          });
        }
        
        // Fallback: If no itemRevenues or calculation failed, try using butcher's average commission
        if (salesRevenue === 0 && butcherRevenue > 0 && butcherConfig) {
          // Get the first available commission rate from the butcher's config
          const commissionRates = Object.values(butcherConfig.commissionRates);
          if (commissionRates.length > 0) {
            // Use average commission rate for this butcher
            const avgCommissionRate = commissionRates.reduce((a, b) => a + b, 0) / commissionRates.length;
            if (avgCommissionRate > 0 && avgCommissionRate < 1) {
              // Formula: salesRevenue = butcherRevenue / (1 - commissionRate)
              salesRevenue = butcherRevenue / (1 - avgCommissionRate);
              hasValidCommissionRate = true;
        }
          }
        }
        
        // Calculate margin only if we have valid sales revenue
        // Margin = Sales Revenue - Butcher Revenue (what we pay to butcher)
        const margin = hasValidCommissionRate && salesRevenue > 0 ? salesRevenue - butcherRevenue : 0;
        
        return {
          orderId: order.id,
          butcherId: order.butcherId || '',
          butcherName: order.butcherName || order.butcherId || '',
          orderDate: orderDateStr,
          items,
          quantity: quantities,
          size: sizes,
          cutType: cutTypes,
          preparingWeight: preparingWeights,
          completionTime,
          startTime,
          status: order.status,
          salesRevenue,
          butcherRevenue,
          margin
        };
      });

      setSalesData(calculatedSalesData);
      
      const butcherMap = new Map<string, ButcherSalesSummary>();
      
      calculatedSalesData.forEach(sale => {
        if (!butcherMap.has(sale.butcherId)) {
          butcherMap.set(sale.butcherId, {
            butcherId: sale.butcherId,
            butcherName: sale.butcherName,
            totalSales: 0,
            totalRevenue: 0,
            totalMargin: 0,
            orderCount: 0
          });
        }
        
        const summary = butcherMap.get(sale.butcherId)!;
        summary.totalSales += sale.salesRevenue;
        summary.totalRevenue += sale.butcherRevenue;
        summary.totalMargin += sale.margin;
        summary.orderCount += 1;
      });
      
      setButcherSummary(Array.from(butcherMap.values()));
      
    } catch (error: any) {
      setError(error.message || 'Try again later');
      setSalesData([]);
      setButcherSummary([]);
      setWeeklyTargets([]);
    }
  }, [allOrders, selectedMonth, selectedYear]);

  const calculateWeeklyTargets = useCallback((salesData: SalesData[]) => {
    if (!monthlyTarget) {
      setWeeklyTargets([
        { week: 1, target: 0, achieved: 0, percentage: 0, status: 'pending' },
        { week: 2, target: 0, achieved: 0, percentage: 0, status: 'pending' },
        { week: 3, target: 0, achieved: 0, percentage: 0, status: 'pending' },
        { week: 4, target: 0, achieved: 0, percentage: 0, status: 'pending' }
      ]);
      return;
    }
    
    const weeklyTarget = monthlyTarget.totalTarget / 4;
    const weeklyAchieved: { [week: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0 };
    
    salesData.forEach(sale => {
      const orderDate = new Date(sale.orderDate.split('/').reverse().join('-'));
      const week = Math.ceil(orderDate.getDate() / 7);
      const weekNum = Math.min(week, 4);
      weeklyAchieved[weekNum] += sale.salesRevenue;
    });
    
    const weeklyTargetsData: WeeklyTarget[] = [1, 2, 3, 4].map(week => {
      const achieved = weeklyAchieved[week];
      const percentage = weeklyTarget > 0 ? (achieved / weeklyTarget) * 100 : 0;
      const status: 'pending' | 'achieved' | 'missed' = 
        percentage >= 100 ? 'achieved' : 
        percentage > 0 ? 'missed' : 
        'pending';
      
      return {
        week,
        target: weeklyTarget,
        achieved,
        percentage,
        status
      };
    });
    
    setWeeklyTargets(weeklyTargetsData);
  }, [monthlyTarget]);

  useEffect(() => {
    calculateSalesDataFromOrders();
  }, [calculateSalesDataFromOrders]);

  useEffect(() => {
    if (salesData.length > 0 || monthlyTarget) {
      calculateWeeklyTargets(salesData);
    }
  }, [salesData, monthlyTarget, calculateWeeklyTargets]);

  useEffect(() => {
    loadMonthlyTarget();
  }, [selectedMonth, selectedYear, loadMonthlyTarget]);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setIsLoading(true);
      try {
        await onRefresh();
      } finally {
        setIsLoading(false);
      }
    }
    
    await loadMonthlyTarget();
  }, [onRefresh, loadMonthlyTarget]);

  const saveMonthlyTarget = async () => {
    if (!targetInput || parseFloat(targetInput) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Target",
        description: "Please enter a valid monthly target amount."
      });
      return;
    }

    // Validate butcher targets if enabled
    if (enableButcherTargets) {
      const butcherTotal = BUTCHER_LIST.reduce((sum, butcher) => {
        return sum + (parseFloat(butcherTargetInputs[butcher.id]) || 0);
      }, 0);
      
      if (butcherTotal <= 0) {
        toast({
          variant: "destructive",
          title: "Invalid Butcher Targets",
          description: "Please enter valid targets for at least one butcher."
        });
        return;
      }
    }

    try {
      setIsSaving(true);
      
      // Prepare butcher targets if enabled
      let butcherTargets = undefined;
      if (enableButcherTargets) {
        butcherTargets = BUTCHER_LIST
          .filter(butcher => parseFloat(butcherTargetInputs[butcher.id]) > 0)
          .map(butcher => ({
            butcherId: butcher.id,
            butcherName: butcher.name,
            target: parseFloat(butcherTargetInputs[butcher.id]) || 0
          }));
      }
      
      const response = await fetch('/api/dam-analysis/target', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          totalTarget: parseFloat(targetInput),
          butcherTargets
        }),
      });

      if (response.ok) {
        toast({
          title: "Target Saved",
          description: enableButcherTargets 
            ? "Monthly target with butcher-specific targets has been saved successfully."
            : "Monthly target has been saved successfully."
        });
        loadMonthlyTarget();
      } else {
        throw new Error('Failed to save target');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save monthly target."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getWeekStatusIcon = (status: string) => {
    switch (status) {
      case 'achieved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'missed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getWeekStatusColor = (status: string) => {
    switch (status) {
      case 'achieved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'missed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getOverallProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPerformanceInsights = () => {
    if (!monthlyTarget) return [];

    // Use API data for total achieved (from Butcher POS sheet)
    const totalSales = monthlyTarget.totalAchieved > 0 
      ? monthlyTarget.totalAchieved 
      : (butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.totalSales, 0) : 0);
    const totalMargin = butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.totalMargin, 0) : 0;
    const totalOrders = butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.orderCount, 0) : 0;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const marginPercentage = totalSales > 0 ? (totalMargin / totalSales) * 100 : 0;
    // Use API-calculated percentage
    const targetAchievement = monthlyTarget.overallPercentage > 0 
      ? monthlyTarget.overallPercentage 
      : (monthlyTarget.totalTarget > 0 ? (totalSales / monthlyTarget.totalTarget) * 100 : 0);

    const insights = [];

    if (totalSales === 0) {
      insights.push({
        type: 'info',
        icon: <Target className="h-4 w-4" />,
        title: 'Target Set',
        description: `Monthly target of ${formatCurrency(monthlyTarget.totalTarget)} has been set. Start tracking your progress!`
      });
    } else if (targetAchievement >= 100) {
      insights.push({
        type: 'success',
        icon: <CheckCircle className="h-4 w-4" />,
        title: 'Target Achieved!',
        description: `You've exceeded your monthly target by ${(targetAchievement - 100).toFixed(1)}%. Great job!`
      });
    } else if (targetAchievement >= 75) {
      insights.push({
        type: 'warning',
        icon: <Clock className="h-4 w-4" />,
        title: 'On Track',
        description: `You're ${targetAchievement.toFixed(1)}% towards your target. Keep up the momentum!`
      });
    } else {
      insights.push({
        type: 'error',
        icon: <AlertCircle className="h-4 w-4" />,
        title: 'Behind Target',
        description: `You're at ${targetAchievement.toFixed(1)}% of your target. Consider increasing marketing efforts.`
      });
    }

    if (marginPercentage >= 20) {
      insights.push({
        type: 'success',
        icon: <TrendingUp className="h-4 w-4" />,
        title: 'Excellent Margins',
        description: `Your margin of ${marginPercentage.toFixed(1)}% is very healthy.`
      });
    } else if (marginPercentage >= 15) {
      insights.push({
        type: 'warning',
        icon: <Activity className="h-4 w-4" />,
        title: 'Good Margins',
        description: `Your margin of ${marginPercentage.toFixed(1)}% is decent but could be improved.`
      });
    } else if (totalSales > 0) {
      insights.push({
        type: 'error',
        icon: <TrendingDown className="h-4 w-4" />,
        title: 'Low Margins',
        description: `Your margin of ${marginPercentage.toFixed(1)}% is below industry standards. Review pricing strategy.`
      });
    }

    if (totalOrders > 0) {
      const avgOrdersPerDay = totalOrders / new Date(selectedYear, selectedMonth, 0).getDate();
      if (avgOrdersPerDay >= 10) {
        insights.push({
          type: 'success',
          icon: <Users className="h-4 w-4" />,
          title: 'High Order Volume',
          description: `Averaging ${avgOrdersPerDay.toFixed(1)} orders per day. Excellent customer engagement!`
        });
      } else if (avgOrdersPerDay >= 5) {
        insights.push({
          type: 'warning',
          icon: <Users className="h-4 w-4" />,
          title: 'Moderate Order Volume',
          description: `Averaging ${avgOrdersPerDay.toFixed(1)} orders per day. Consider promotional campaigns.`
        });
      } else {
        insights.push({
          type: 'error',
          icon: <Users className="h-4 w-4" />,
          title: 'Low Order Volume',
          description: `Averaging ${avgOrdersPerDay.toFixed(1)} orders per day. Focus on customer acquisition.`
        });
      }
    }

    if (butcherSummary.length > 0) {
      const topPerformer = butcherSummary.reduce((max, butcher) => 
        butcher.totalSales > max.totalSales ? butcher : max, butcherSummary[0]);
      if (topPerformer) {
        insights.push({
          type: 'info',
          icon: <Target className="h-4 w-4" />,
          title: 'Top Performer',
          description: `${topPerformer.butcherName} leads with ${formatCurrency(topPerformer.totalSales)} in sales.`
        });
      }
    }

    return insights;
  };

  // Generate improvement recommendations
  const getImprovementRecommendations = () => {
    if (!monthlyTarget) return [];

    // Use API data for total achieved (from Butcher POS sheet)
    const totalSales = monthlyTarget.totalAchieved > 0 
      ? monthlyTarget.totalAchieved 
      : (butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.totalSales, 0) : 0);
    const totalMargin = butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.totalMargin, 0) : 0;
    const marginPercentage = totalSales > 0 ? (totalMargin / totalSales) * 100 : 0;
    // Use API-calculated percentage
    const targetAchievement = monthlyTarget.overallPercentage > 0 
      ? monthlyTarget.overallPercentage 
      : (monthlyTarget.totalTarget > 0 ? (totalSales / monthlyTarget.totalTarget) * 100 : 0);

    const recommendations = [];

    if (totalSales === 0) {
      recommendations.push({
        icon: <TrendingUp className="h-4 w-4" />,
        title: 'Start Your Sales Journey',
        description: `You have a target of ${formatCurrency(monthlyTarget.totalTarget)} to achieve this month. Get started with:`,
        actions: [
          'Launch promotional campaigns',
          'Reach out to existing customers',
          'Create attractive bundle offers',
          'Focus on high-margin products'
        ]
      });
    } else if (targetAchievement < 100) {
      const shortfall = monthlyTarget.totalTarget - totalSales;
      recommendations.push({
        icon: <TrendingUp className="h-4 w-4" />,
        title: 'Increase Sales Volume',
        description: `You need ${formatCurrency(shortfall)} more to reach your target. Consider:`,
        actions: [
          'Launch promotional campaigns',
          'Expand marketing channels',
          'Offer bundle deals',
          'Improve customer retention'
        ]
      });
    }

    if (marginPercentage < 20 && totalSales > 0) {
      recommendations.push({
        icon: <DollarSign className="h-4 w-4" />,
        title: 'Improve Profit Margins',
        description: 'Your margins are below optimal levels. Consider:',
        actions: [
          'Review pricing strategy',
          'Negotiate better supplier rates',
          'Reduce operational costs',
          'Focus on high-margin items'
        ]
      });
    }

    // Find underperforming butchers
    if (butcherSummary.length > 0) {
      const avgSalesPerButcher = totalSales / butcherSummary.length;
      const underperformers = butcherSummary.filter(b => b.totalSales < avgSalesPerButcher * 0.7);
      
      if (underperformers.length > 0) {
        recommendations.push({
          icon: <Users className="h-4 w-4" />,
          title: 'Support Underperforming Butchers',
          description: `Some butchers need additional support:`,
          actions: [
            'Provide training sessions',
            'Review their product mix',
            'Offer marketing support',
            'Analyze customer feedback'
          ]
        });
      }
    }

    recommendations.push({
      icon: <BarChart3 className="h-4 w-4" />,
      title: 'Data-Driven Improvements',
      description: 'Use analytics to optimize performance:',
      actions: [
        'Track daily sales trends',
        'Monitor customer preferences',
        'Analyze seasonal patterns',
        'Implement A/B testing'
      ]
    });

    return recommendations;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-col gap-4">
            {/* Title Section */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">D.A.M Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Daily, Weekly & Monthly Sales Target Tracking
                </p>
              </div>
            </div>
            {/* Controls Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label htmlFor="month-select" className="text-sm whitespace-nowrap">Month:</Label>
                  <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="year-select" className="text-sm whitespace-nowrap">Year:</Label>
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isLoading || externalIsLoading}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading || externalIsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="targets" className="space-y-4 sm:space-y-6">
        <TabsList 
          ref={tabsListRef}
          className="w-full overflow-x-auto flex sm:grid sm:grid-cols-6 gap-1 sm:gap-2 p-1 sm:p-1 h-auto sm:h-10 px-0 sm:px-1 scrollbar-hide justify-start"
          style={{ scrollBehavior: 'smooth' }}
        >
          <TabsTrigger value="targets" className="flex items-center gap-2 whitespace-nowrap pl-4 pr-3 sm:px-4 flex-shrink-0 min-w-fit">
            <Target className="h-4 w-4 flex-shrink-0" />
            <span>Targets</span>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Weekly Progress</span>
            <span className="sm:hidden">Weekly</span>
          </TabsTrigger>
          <TabsTrigger value="butchers" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Butcher Analysis</span>
            <span className="sm:hidden">Butchers</span>
          </TabsTrigger>
          <TabsTrigger value="margin" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
            <DollarSign className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Margin Analysis</span>
            <span className="sm:hidden">$ Margin</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-shrink-0 min-w-fit">
            <Lightbulb className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Performance Insights</span>
            <span className="sm:hidden">Insights</span>
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2 whitespace-nowrap pl-3 pr-4 sm:px-4 flex-shrink-0 min-w-fit">
            <TrendingUp className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Recommendations</span>
            <span className="sm:hidden">Tips</span>
          </TabsTrigger>
        </TabsList>

        {/* Targets Tab */}
        <TabsContent value="targets" className="space-y-6">
          <Card className="w-full max-w-full">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Target className="h-5 w-5" />
                Monthly Target Setting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target-input">Monthly Target (₹)</Label>
                  <Input
                    id="target-input"
                    type="number"
                    placeholder="Enter monthly target"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={saveMonthlyTarget} 
                    disabled={isSaving}
                    className="w-full"
                  >
                    {isSaving ? 'Saving...' : 'Save Target'}
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="w-full flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                </div>
              </div>
              
              {/* Butcher-specific targets toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="enable-butcher-targets"
                  checked={enableButcherTargets}
                  onChange={(e) => setEnableButcherTargets(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="enable-butcher-targets" className="text-sm cursor-pointer">
                  Split target by butcher (optional)
                </Label>
              </div>
              
              {/* Butcher-specific target inputs */}
              {enableButcherTargets && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Butcher-specific Targets
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {BUTCHER_LIST.map((butcher) => (
                      <div key={butcher.id} className="space-y-1">
                        <Label htmlFor={`butcher-target-${butcher.id}`} className="text-xs text-muted-foreground">
                          {butcher.name}
                        </Label>
                        <Input
                          id={`butcher-target-${butcher.id}`}
                          type="number"
                          placeholder="0"
                          value={butcherTargetInputs[butcher.id] || ''}
                          onChange={(e) => setButcherTargetInputs(prev => ({
                            ...prev,
                            [butcher.id]: e.target.value
                          }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Total: {formatCurrency(BUTCHER_LIST.reduce((sum, b) => sum + (parseFloat(butcherTargetInputs[b.id]) || 0), 0))}
                  </p>
                </div>
              )}

              {isLoading && !monthlyTarget ? (
                <div className="mt-6 p-4 bg-muted rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </div>
                </div>
              ) : monthlyTarget && (
                <div className="mt-6 space-y-4">
                  {/* Overall Progress */}
                  <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      {months[selectedMonth - 1]?.label} {selectedYear} Target
                    </h3>
                    <Badge variant="outline" className="text-lg font-bold">
                      {formatCurrency(monthlyTarget.totalTarget)}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall Progress</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(monthlyTarget.totalAchieved)} / {formatCurrency(monthlyTarget.totalTarget)}
                      </span>
                    </div>
                    <Progress 
                        value={Math.min(monthlyTarget.overallPercentage, 100)} 
                      className="h-3"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">0%</span>
                      <span className={`font-semibold ${getOverallProgressColor(monthlyTarget.overallPercentage).replace('bg-', 'text-')}`}>
                        {monthlyTarget.overallPercentage.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">100%</span>
                    </div>
                    </div>
                  </div>
                  
                  {/* Butcher-specific Progress */}
                  {monthlyTarget.isButcherSpecific && monthlyTarget.butcherTargets && monthlyTarget.butcherTargets.length > 0 && (
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Butcher Progress
                      </h4>
                      <div className="space-y-3">
                        {monthlyTarget.butcherTargets.map((bt) => (
                          <div key={bt.butcherId} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{bt.butcherName}</span>
                              <span className="text-muted-foreground">
                                {formatCurrency(bt.achieved)} / {formatCurrency(bt.target)}
                                <span className={`ml-2 font-semibold ${bt.percentage >= 100 ? 'text-green-600' : bt.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  ({bt.percentage.toFixed(1)}%)
                                </span>
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(bt.percentage, 100)} 
                              className="h-2"
                            />
                          </div>
                        ))}
                  </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Progress Tab */}
        <TabsContent value="weekly" className="space-y-6">
          {isLoading && weeklyTargets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-4 w-4 rounded-full" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-2 w-full" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (monthlyTarget || weeklyTargets.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Prefer API data from monthlyTarget.weeklyTargets for accurate Butcher POS data */}
              {(monthlyTarget?.weeklyTargets && monthlyTarget.weeklyTargets.length > 0 ? monthlyTarget.weeklyTargets : weeklyTargets).map((week) => (
                <Card key={week.week}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Week {week.week}</CardTitle>
                      {getWeekStatusIcon(week.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Target</span>
                        <span className="font-medium">{formatCurrency(week.target)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Achieved</span>
                        <span className="font-medium">{formatCurrency(week.achieved)}</span>
                      </div>
                    </div>
                    
                    <Progress value={week.percentage} className="h-2" />
                    
                    <div className="flex items-center justify-between">
                      <Badge className={getWeekStatusColor(week.status)}>
                        {week.status}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {week.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Butcher Analysis Tab */}
        <TabsContent value="butchers" className="space-y-6">
          {isLoading && butcherSummary.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <Skeleton className="h-5 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : butcherSummary.length === 0 && monthlyTarget ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Butcher Performance
                </CardTitle>
                <CardDescription>
                  No sales data available yet. Performance will be tracked once orders start coming in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    Target set: {formatCurrency(monthlyTarget.totalTarget)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Butcher performance will be displayed here once sales data is available.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {butcherSummary.map((butcher) => (
                <Card key={butcher.butcherId}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {butcher.butcherName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Sales</span>
                        <span className="font-medium">{formatCurrency(butcher.totalSales)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Orders</span>
                        <span className="font-medium">{butcher.orderCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Avg/Order</span>
                        <span className="font-medium">
                          {formatCurrency(butcher.orderCount > 0 ? butcher.totalSales / butcher.orderCount : 0)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span>Margin</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(butcher.totalMargin)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Margin Analysis Tab */}
        <TabsContent value="margin" className="space-y-6">
          {butcherSummary.length === 0 && monthlyTarget ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Margin Analysis
                </CardTitle>
                <CardDescription>
                  Margin analysis will be available once sales data is recorded.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    Target: {formatCurrency(monthlyTarget.totalTarget)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Margin analysis will be displayed here once sales transactions are recorded.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Total Sales Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {formatCurrency(butcherSummary.reduce((sum, b) => sum + b.totalSales, 0))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Revenue from all butchers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5" />
                    Total Butcher Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(butcherSummary.reduce((sum, b) => sum + b.totalRevenue, 0))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Revenue paid to butchers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Total Company Margin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-600">
                    {formatCurrency(butcherSummary.reduce((sum, b) => sum + b.totalMargin, 0))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Company profit margin
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {butcherSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Margin Breakdown by Butcher</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {butcherSummary.map((butcher) => {
                    const marginPercentage = butcher.totalSales > 0 
                      ? (butcher.totalMargin / butcher.totalSales) * 100 
                      : 0;
                    
                    return (
                      <div key={butcher.butcherId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium">{butcher.butcherName}</div>
                          <div className="text-sm text-muted-foreground">
                            {butcher.orderCount} orders
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-600">
                            {formatCurrency(butcher.totalMargin)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {marginPercentage.toFixed(1)}% margin
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {getPerformanceInsights().map((insight, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      insight.type === 'success' ? 'bg-green-100 text-green-600' :
                      insight.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                      insight.type === 'error' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {insight.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{insight.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{insight.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Weekly Sales Chart */}
          {(monthlyTarget || weeklyTargets.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Weekly Sales Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Prefer API data from monthlyTarget.weeklyTargets for accurate Butcher POS data */}
                  {(monthlyTarget?.weeklyTargets && monthlyTarget.weeklyTargets.length > 0 ? monthlyTarget.weeklyTargets : weeklyTargets).map((week) => (
                    <div key={week.week} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Week {week.week}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(week.achieved)} / {formatCurrency(week.target)}
                          </span>
                          <Badge className={getWeekStatusColor(week.status)}>
                            {week.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={week.percentage} className="h-3" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Performance Improvement Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!monthlyTarget ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-2">No monthly target set</p>
                  <p className="text-sm text-muted-foreground">
                    Set a monthly target in the "Target Setting" tab to get personalized recommendations.
                  </p>
                </div>
              ) : getImprovementRecommendations().length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-muted-foreground">All targets are on track!</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Keep up the great work. Continue monitoring your performance.
                  </p>
                </div>
              ) : (
              <div className="space-y-6">
                {getImprovementRecommendations().map((rec, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        {rec.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{rec.title}</h3>
                        <p className="text-muted-foreground mb-3">{rec.description}</p>
                        <ul className="space-y-1">
                          {rec.actions.map((action, actionIndex) => (
                            <li key={actionIndex} className="flex items-center gap-2 text-sm">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DAMAnalysis;
