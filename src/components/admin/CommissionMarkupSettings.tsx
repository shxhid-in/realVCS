"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { useToast } from "../../hooks/use-toast"
import { 
  getDefaultButcherRates,
  getButcherCategories
} from "../../lib/butcherConfig"
import {
  validateRate, 
  formatRate, 
  parseRate
} from "../../lib/rates"
import type { ButcherRates, CommissionRate, MarkupRate } from "../../lib/types"
import { freshButchers } from "../../lib/butcherConfig"
import { Save, RefreshCw, DollarSign, Percent } from "lucide-react"

export function CommissionMarkupSettings() {
  const { toast } = useToast()
  const [butcherRates, setButcherRates] = useState<ButcherRates[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedButcher, setSelectedButcher] = useState<string>('')

  // Load rates on component mount
  useEffect(() => {
    const loadRates = async () => {
      try {
        const response = await fetch('/api/rates')
        if (response.ok) {
          const data = await response.json()
          setButcherRates(data.rates)
          if (data.rates.length > 0) {
            setSelectedButcher(data.rates[0].butcherId)
          }
        } else {
          // Fallback to defaults if API fails
          const defaultRates = getDefaultButcherRates()
          setButcherRates(defaultRates)
          if (defaultRates.length > 0) {
            setSelectedButcher(defaultRates[0].butcherId)
          }
        }
      } catch (error) {
        // Fallback to defaults
        const defaultRates = getDefaultButcherRates()
        setButcherRates(defaultRates)
        if (defaultRates.length > 0) {
          setSelectedButcher(defaultRates[0].butcherId)
        }
      } finally {
        setIsLoading(false)
      }
    }
    
    loadRates()
  }, [])

  // Get current butcher data
  const currentButcher = butcherRates.find(b => b.butcherId === selectedButcher)
  const butcherInfo = freshButchers.find(b => b.id === selectedButcher)

  // Update commission rate
  const updateCommissionRate = (category: string, rate: number) => {
    if (!validateRate(rate)) {
      toast({
        variant: "destructive",
        title: "Invalid Rate",
        description: "Rate must be between 0% and 100%",
      })
      return
    }

    setButcherRates(prev => prev.map(butcher => {
      if (butcher.butcherId === selectedButcher) {
        const updatedRates = butcher.commissionRates.map((cr: CommissionRate) => 
          cr.category === category ? { ...cr, rate } : cr
        )
        
        // If category doesn't exist, add it
        if (!butcher.commissionRates.find((cr: CommissionRate) => cr.category === category)) {
          updatedRates.push({ butcherId: selectedButcher, category, rate })
        }
        
        return { ...butcher, commissionRates: updatedRates }
      }
      return butcher
    }))
  }

  // Update markup rate
  const updateMarkupRate = (category: string, rate: number) => {
    if (!validateRate(rate)) {
      toast({
        variant: "destructive",
        title: "Invalid Rate",
        description: "Rate must be between 0% and 100%",
      })
      return
    }

    setButcherRates(prev => prev.map(butcher => {
      if (butcher.butcherId === selectedButcher) {
        const updatedRates = butcher.markupRates.map((mr: MarkupRate) => 
          mr.category === category ? { ...mr, rate } : mr
        )
        
        // If category doesn't exist, add it
        if (!butcher.markupRates.find((mr: MarkupRate) => mr.category === category)) {
          updatedRates.push({ butcherId: selectedButcher, category, rate })
        }
        
        return { ...butcher, markupRates: updatedRates }
      }
      return butcher
    }))
  }

  // Save rates to Google Sheets
  const saveRates = async () => {
    setIsSaving(true)
    try {
      
      const response = await fetch('/api/rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rates: butcherRates }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Rates Saved",
          description: "Commission and markup rates have been saved successfully to Google Sheets!",
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save rates')
      }
    } catch (error) {
      
      // Provide more specific error messages
      let errorMessage = "Failed to save rates"
      if (error instanceof Error) {
        if (error.message.includes('BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured')) {
          errorMessage = "Google Sheets configuration missing. Please check environment variables."
        } else if (error.message.includes('Missing Google credentials')) {
          errorMessage = "Google Sheets authentication failed. Please check credentials."
        } else if (error.message.includes('Failed to authenticate')) {
          errorMessage = "Google Sheets authentication error. Please verify service account permissions."
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        variant: "destructive",
        title: "Error Saving Rates",
        description: errorMessage,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to defaults
  const resetToDefaults = () => {
    const defaultRates = getDefaultButcherRates()
    setButcherRates(defaultRates)
    toast({
      title: "Reset to Defaults",
      description: "All rates have been reset to default values.",
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading settings...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Commission & Markup Rates
          </CardTitle>
          <CardDescription>
            Configure commission rates and markup percentages for each butcher and category
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Butcher Selection */}
          <div className="space-y-2">
            <Label>Select Butcher</Label>
            <Select value={selectedButcher} onValueChange={setSelectedButcher}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Choose a butcher" />
              </SelectTrigger>
              <SelectContent>
                {butcherRates.map(butcher => (
                  <SelectItem key={butcher.butcherId} value={butcher.butcherId}>
                    {butcher.butcherName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={saveRates} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Rates"}
            </Button>
            <Button variant="outline" onClick={resetToDefaults}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>

          {/* Rates Configuration */}
          {currentButcher && butcherInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{butcherInfo.name} - Rate Configuration</CardTitle>
                <CardDescription>
                  Set commission rates and markup percentages for each category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="commission" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="commission" className="flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Commission Rates
                    </TabsTrigger>
                    <TabsTrigger value="markup" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Markup Rates
                    </TabsTrigger>
                  </TabsList>

                  {/* Commission Rates Tab */}
                  <TabsContent value="commission" className="space-y-4">
                    <div className="text-sm text-muted-foreground mb-4">
                      Commission rates determine the percentage of revenue that goes to the butcher
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Current Rate</TableHead>
                          <TableHead>New Rate (%)</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getButcherCategories(selectedButcher).map(category => {
                          const currentRate = currentButcher.commissionRates.find((cr: CommissionRate) => cr.category === category)
                          const rateValue = currentRate ? currentRate.rate : 0.07
                          
                          return (
                            <TableRow key={category}>
                              <TableCell className="font-medium capitalize">
                                {category.replace('_', ' ')}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {formatRate(rateValue)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  defaultValue={rateValue * 100}
                                  className="w-24"
                                  onChange={(e) => {
                                    const newRate = parseRate(e.target.value)
                                    updateCommissionRate(category, newRate)
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const input = document.querySelector(`input[data-category="${category}"]`) as HTMLInputElement
                                    if (input) {
                                      const newRate = parseRate(input.value)
                                      updateCommissionRate(category, newRate)
                                    }
                                  }}
                                >
                                  Update
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  {/* Markup Rates Tab */}
                  <TabsContent value="markup" className="space-y-4">
                    <div className="text-sm text-muted-foreground mb-4">
                      Markup rates determine the percentage added to purchase prices for selling prices
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Current Rate</TableHead>
                          <TableHead>New Rate (%)</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getButcherCategories(selectedButcher).map(category => {
                          const currentRate = currentButcher.markupRates.find((mr: MarkupRate) => mr.category === category)
                          const rateValue = currentRate ? currentRate.rate : 0.05
                          
                          return (
                            <TableRow key={category}>
                              <TableCell className="font-medium capitalize">
                                {category.replace('_', ' ')}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {formatRate(rateValue)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  defaultValue={rateValue * 100}
                                  className="w-24"
                                  data-category={category}
                                  onChange={(e) => {
                                    const newRate = parseRate(e.target.value)
                                    updateMarkupRate(category, newRate)
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const input = document.querySelector(`input[data-category="${category}"]`) as HTMLInputElement
                                    if (input) {
                                      const newRate = parseRate(input.value)
                                      updateMarkupRate(category, newRate)
                                    }
                                  }}
                                >
                                  Update
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rate Summary</CardTitle>
              <CardDescription>
                Overview of all configured rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {butcherRates.map(butcher => (
                  <div key={butcher.butcherId} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">{butcher.butcherName}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-muted-foreground mb-1">Commission Rates</h5>
                        <div className="space-y-1">
                          {butcher.commissionRates.map((rate: CommissionRate) => (
                            <div key={rate.category} className="flex justify-between text-sm">
                              <span className="capitalize">{rate.category.replace('_', ' ')}</span>
                              <Badge variant="outline">{formatRate(rate.rate)}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-muted-foreground mb-1">Markup Rates</h5>
                        <div className="space-y-1">
                          {butcher.markupRates.map((rate: MarkupRate) => (
                            <div key={rate.category} className="flex justify-between text-sm">
                              <span className="capitalize">{rate.category.replace('_', ' ')}</span>
                              <Badge variant="outline">{formatRate(rate.rate)}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
