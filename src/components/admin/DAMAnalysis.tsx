'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Activity
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface WeeklyTarget {
  week: number;
  target: number;
  achieved: number;
  percentage: number;
  status: 'pending' | 'achieved' | 'missed';
}

interface MonthlyTarget {
  month: string;
  year: number;
  totalTarget: number;
  weeklyTargets: WeeklyTarget[];
  totalAchieved: number;
  overallPercentage: number;
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

const DAMAnalysis: React.FC = () => {
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [butcherSummary, setButcherSummary] = useState<ButcherSalesSummary[]>([]);
  const [weeklyTargets, setWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [targetInput, setTargetInput] = useState('');

  // Generate month options
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

  // Generate year options (current year ± 2)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    loadMonthlyTarget();
    loadSalesData();
  }, [selectedMonth, selectedYear]);

  const loadMonthlyTarget = async () => {
    try {
      setIsLoading(true);
      console.log('Loading monthly target for:', { selectedMonth, selectedYear });
      const response = await fetch(`/api/dam-analysis/target?month=${selectedMonth}&year=${selectedYear}`);
      console.log('Target API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Target API response data:', data);
        setMonthlyTarget(data);
        setTargetInput(data?.totalTarget?.toString() || '');
      } else {
        console.log('Target API error:', response.status, response.statusText);
        setMonthlyTarget(null);
        setTargetInput('');
      }
    } catch (error) {
      console.error('Error loading monthly target:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load monthly target data."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSalesData = async () => {
    try {
      setIsLoading(true);
      console.log('Loading sales data for:', { selectedMonth, selectedYear });
      const response = await fetch(`/api/dam-analysis/sales?month=${selectedMonth}&year=${selectedYear}`);
      console.log('Sales API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Sales API response data:', data);
        setSalesData(data.salesData || []);
        setButcherSummary(data.butcherSummary || []);
        setWeeklyTargets(data.weeklyTargets || []);
      } else {
        console.log('Sales API error:', response.status, response.statusText);
        setSalesData([]);
        setButcherSummary([]);
        setWeeklyTargets([]);
      }
    } catch (error) {
      console.error('Error loading sales data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load sales data."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveMonthlyTarget = async () => {
    if (!targetInput || parseFloat(targetInput) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Target",
        description: "Please enter a valid monthly target amount."
      });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/dam-analysis/target', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          totalTarget: parseFloat(targetInput)
        }),
      });

      if (response.ok) {
        toast({
          title: "Target Saved",
          description: "Monthly target has been saved successfully."
        });
        loadMonthlyTarget();
      } else {
        throw new Error('Failed to save target');
      }
    } catch (error) {
      console.error('Error saving monthly target:', error);
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

  // Calculate performance insights
  const getPerformanceInsights = () => {
    if (!monthlyTarget) return [];

    const totalSales = butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.totalSales, 0) : 0;
    const totalMargin = butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.totalMargin, 0) : 0;
    const totalOrders = butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.orderCount, 0) : 0;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const marginPercentage = totalSales > 0 ? (totalMargin / totalSales) * 100 : 0;
    const targetAchievement = monthlyTarget.totalTarget > 0 ? (totalSales / monthlyTarget.totalTarget) * 100 : 0;

    const insights = [];

    // Target achievement insight
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

    // Margin insight
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

    // Order volume insight
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

    // Top performer insight
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

    const totalSales = butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.totalSales, 0) : 0;
    const totalMargin = butcherSummary.length > 0 ? butcherSummary.reduce((sum, b) => sum + b.totalMargin, 0) : 0;
    const marginPercentage = totalSales > 0 ? (totalMargin / totalSales) * 100 : 0;
    const targetAchievement = monthlyTarget.totalTarget > 0 ? (totalSales / monthlyTarget.totalTarget) * 100 : 0;

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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl">D.A.M Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Daily, Weekly & Monthly Sales Target Tracking
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="month-select">Month:</Label>
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
                <Label htmlFor="year-select">Year:</Label>
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
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="targets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Progress</TabsTrigger>
          <TabsTrigger value="butchers">Butcher Analysis</TabsTrigger>
          <TabsTrigger value="margin">Margin Analysis</TabsTrigger>
          <TabsTrigger value="insights">Performance Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Targets Tab */}
        <TabsContent value="targets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Monthly Target Setting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    onClick={loadMonthlyTarget}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                </div>
              </div>

              {monthlyTarget && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
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
                      value={monthlyTarget.overallPercentage} 
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Progress Tab */}
        <TabsContent value="weekly" className="space-y-6">
          {(monthlyTarget || weeklyTargets.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(weeklyTargets.length > 0 ? weeklyTargets : monthlyTarget?.weeklyTargets || []).map((week) => (
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
          {butcherSummary.length === 0 && monthlyTarget ? (
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
                  {(weeklyTargets.length > 0 ? weeklyTargets : monthlyTarget?.weeklyTargets || []).map((week) => (
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
              <div className="space-y-6">
                {getImprovementRecommendations().map((rec, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DAMAnalysis;
