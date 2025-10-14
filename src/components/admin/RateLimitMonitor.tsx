"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Progress } from "../ui/progress"
import { Alert, AlertDescription } from "../ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  Server, 
  TrendingUp,
  Zap,
  AlertCircle,
  BarChart3,
  Globe
} from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "../ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Area, AreaChart, ResponsiveContainer } from "recharts"
import { format } from "date-fns"

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  apiQuotaUsage: number;
  apiQuotaLimit: number;
  quotaPercentage: number;
  responseTime: number;
  errorRate: number;
  uptime: number;
  lastUpdated: string;
}

interface ApiMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
  quotaExceededCount: number;
  callsPerMinute: number;
  callsPerHour: number;
  lastHour: number;
  last24Hours: number;
}

interface EndpointStat {
  endpoint: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  averageResponseTime: number;
  quotaExceeded: number;
}

interface HourlyData {
  hour: string;
  calls: number;
  errors: number;
  averageResponseTime: number;
}

interface RecentError {
  timestamp: string;
  endpoint: string;
  method: string;
  status: number;
  error?: string;
  duration: number;
}

interface SheetMetric {
  sheetName: string;
  sheetId?: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  quotaExceededCount: number;
  averageResponseTime: number;
  callsPerMinute: number;
  callsPerHour: number;
  successRate: number;
  lastCall?: string;
}

interface RateMonitorData {
  systemHealth: SystemHealth;
  metrics: ApiMetrics;
  hourlyBreakdown: HourlyData[];
  endpointStats: EndpointStat[];
  sheetMetrics: SheetMetric[];
  recentErrors: RecentError[];
  quotaInfo: {
    googleSheetsLimits: {
      requestsPerMinute: number;
      requestsPer100Seconds: number;
      dailyQuota: number;
    };
    currentUsage: {
      perMinute: number;
      perHour: number;
      percentage: number;
    };
    recommendations: string[];
  };
  sheetsInfo: {
    [key: string]: {
      name: string;
      description: string;
      envVar: string;
    };
  };
}

const chartConfig = {
  calls: {
    label: "API Calls",
    color: "hsl(var(--primary))",
  },
  errors: {
    label: "Errors",
    color: "hsl(var(--destructive))",
  },
  responseTime: {
    label: "Response Time (ms)",
    color: "hsl(var(--secondary))",
  },
} satisfies ChartConfig

export function RateLimitMonitor() {
  const [data, setData] = useState<RateMonitorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = async () => {
    try {
      setError(null)
      const response = await fetch('/api/rate-monitor')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error fetching rate monitor data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'critical': return <AlertCircle className="h-5 w-5 text-red-600" />
      default: return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / (1000 * 60 * 60))
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Rate Limit Monitor</h2>
            <p className="text-muted-foreground">System health and API usage monitoring</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Rate Limit Monitor</h2>
            <p className="text-muted-foreground">System health and API usage monitoring</p>
          </div>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load monitoring data: {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Rate Limit Monitor</h2>
          <p className="text-muted-foreground">
            System health and Google Sheets API usage monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {getStatusIcon(data.systemHealth.status)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(data.systemHealth.status)}`}>
              {data.systemHealth.status.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated: {format(new Date(data.systemHealth.lastUpdated), 'HH:mm:ss')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Quota Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data.systemHealth.quotaPercentage)}%</div>
            <Progress value={data.systemHealth.quotaPercentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data.systemHealth.apiQuotaUsage}/{data.systemHealth.apiQuotaLimit} calls/min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data.systemHealth.responseTime)}ms</div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUptime(data.systemHealth.uptime)}</div>
            <p className="text-xs text-muted-foreground">
              Error rate: {data.systemHealth.errorRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {data.quotaInfo.recommendations.length > 0 && (
        <Alert variant={data.systemHealth.status === 'critical' ? 'destructive' : 
                       data.systemHealth.status === 'warning' ? 'default' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {data.quotaInfo.recommendations.map((rec, index) => (
                <div key={index}>• {rec}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>API Call Statistics</CardTitle>
                <CardDescription>Current API usage metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{data.metrics.successfulCalls}</div>
                    <p className="text-sm text-muted-foreground">Successful calls</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{data.metrics.failedCalls}</div>
                    <p className="text-sm text-muted-foreground">Failed calls</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{data.metrics.callsPerMinute}</div>
                    <p className="text-sm text-muted-foreground">Calls/minute</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{data.metrics.callsPerHour}</div>
                    <p className="text-sm text-muted-foreground">Calls/hour</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Google Sheets Quota</CardTitle>
                <CardDescription>API quota limits and usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Requests per minute</span>
                    <span>{data.quotaInfo.currentUsage.perMinute}/{data.quotaInfo.googleSheetsLimits.requestsPerMinute}</span>
                  </div>
                  <Progress value={(data.quotaInfo.currentUsage.perMinute / data.quotaInfo.googleSheetsLimits.requestsPerMinute) * 100} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Requests per hour</span>
                    <span>{data.quotaInfo.currentUsage.perHour}/6000</span>
                  </div>
                  <Progress value={(data.quotaInfo.currentUsage.perHour / 6000) * 100} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Daily quota: {data.quotaInfo.googleSheetsLimits.dailyQuota} requests
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sheets" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Google Sheets Overview</CardTitle>
                <CardDescription>All Google Sheets used by the system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.sheetsInfo && Object.entries(data.sheetsInfo).map(([key, info]) => (
                  <div key={key} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{info.name}</h4>
                      <Badge variant="outline">{info.envVar}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{info.description}</p>
                    
                    {/* Find matching sheet metrics */}
                    {(() => {
                      const sheetMetric = data.sheetMetrics?.find(m => 
                        m.sheetName.toLowerCase().includes(info.name.toLowerCase().split(' ')[0])
                      );
                      
                      if (sheetMetric) {
                        return (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total Calls:</span>
                              <span className="ml-2 font-medium">{sheetMetric.totalCalls}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Success Rate:</span>
                              <span className="ml-2 font-medium">{sheetMetric.successRate}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Calls/Min:</span>
                              <span className="ml-2 font-medium">{sheetMetric.callsPerMinute}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Avg Response:</span>
                              <span className="ml-2 font-medium">{sheetMetric.averageResponseTime}ms</span>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="text-sm text-muted-foreground">
                            No recent API calls detected
                          </div>
                        );
                      }
                    })()}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sheet Performance Metrics</CardTitle>
                <CardDescription>Detailed performance by Google Sheet</CardDescription>
              </CardHeader>
              <CardContent>
                {data.sheetMetrics && data.sheetMetrics.length > 0 ? (
                  <div className="space-y-4">
                    {data.sheetMetrics.map((sheet, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold">{sheet.sheetName}</h4>
                          <Badge variant={sheet.successRate >= 95 ? "default" : sheet.successRate >= 90 ? "secondary" : "destructive"}>
                            {sheet.successRate}% Success
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground">Total Calls</div>
                            <div className="font-medium">{sheet.totalCalls}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Per Minute</div>
                            <div className="font-medium">{sheet.callsPerMinute}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Response Time</div>
                            <div className="font-medium">{sheet.averageResponseTime}ms</div>
                          </div>
                        </div>
                        
                        {sheet.quotaExceededCount > 0 && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            <AlertTriangle className="h-4 w-4 inline mr-1" />
                            {sheet.quotaExceededCount} quota exceeded errors
                          </div>
                        )}
                        
                        {sheet.lastCall && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Last call: {format(new Date(sheet.lastCall), 'HH:mm:ss')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No sheet-specific metrics available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Endpoint Performance</CardTitle>
              <CardDescription>API endpoint statistics and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Total Calls</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Avg Response</TableHead>
                    <TableHead>Quota Exceeded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.endpointStats.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{stat.endpoint}</TableCell>
                      <TableCell>{stat.totalCalls}</TableCell>
                      <TableCell>
                        <Badge variant={stat.successRate >= 95 ? "default" : stat.successRate >= 90 ? "secondary" : "destructive"}>
                          {stat.successRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{stat.averageResponseTime}ms</TableCell>
                      <TableCell>
                        {stat.quotaExceeded > 0 ? (
                          <Badge variant="destructive">{stat.quotaExceeded}</Badge>
                        ) : (
                          <Badge variant="outline">0</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>24-Hour API Usage Trends</CardTitle>
              <CardDescription>Hourly breakdown of API calls and response times</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.hourlyBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="calls" 
                      stroke="var(--color-calls)" 
                      fill="var(--color-calls)" 
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="errors" 
                      stroke="var(--color-errors)" 
                      fill="var(--color-errors)" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Time Trends</CardTitle>
              <CardDescription>Average response times over the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.hourlyBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="averageResponseTime" 
                      stroke="var(--color-responseTime)" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Latest API errors and failures</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentErrors.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <p className="text-muted-foreground">No recent errors found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentErrors.map((error, index) => (
                      <TableRow key={index}>
                        <TableCell>{format(new Date(error.timestamp), 'HH:mm:ss')}</TableCell>
                        <TableCell className="font-mono text-sm">{error.endpoint}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{error.method}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={error.status >= 500 ? "destructive" : "secondary"}>
                            {error.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{error.duration}ms</TableCell>
                        <TableCell className="max-w-xs truncate" title={error.error}>
                          {error.error || 'Unknown error'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
