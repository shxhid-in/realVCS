"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useToast } from "../../hooks/use-toast"
import { Loader2, Plus, Trash2, IndianRupee, Search, Check } from "lucide-react"

interface CreateInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Contact {
  contact_id: string
  contact_name: string
  company_name?: string
  email?: string
  phone?: string
}

interface LineItem {
  id: string
  name: string
  description: string
  quantity: number
  rate: number
  unit: string
}

export function CreateInvoiceModal({ isOpen, onClose, onSuccess }: CreateInvoiceModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSearchingContacts, setIsSearchingContacts] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    date: new Date().toISOString().split('T')[0],
    reference_number: '', // Order number
    shipping_charge: 0,
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', name: '', description: '', quantity: 1, rate: 0, unit: 'kg' }
  ])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search contacts with debounce
  const searchContacts = useCallback(async (search: string) => {
    if (search.length < 2) {
      setContacts([])
      return
    }
    
    setIsSearchingContacts(true)
    try {
      const response = await fetch(`/api/zoho/contacts?search=${encodeURIComponent(search)}`)
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
      }
    } catch {
      // Error searching contacts - silently fail
    } finally {
      setIsSearchingContacts(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch && !formData.customer_id) {
        searchContacts(customerSearch)
        setShowDropdown(true)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, searchContacts, formData.customer_id])

  const handleCustomerInputChange = (value: string) => {
    setCustomerSearch(value)
    // Clear selection if user is typing
    if (formData.customer_id) {
      setFormData({ ...formData, customer_id: '', customer_name: '' })
    }
  }

  const handleSelectCustomer = (contact: Contact) => {
    setFormData({
      ...formData,
      customer_id: contact.contact_id,
      customer_name: contact.contact_name,
    })
    setCustomerSearch(contact.contact_name)
    setShowDropdown(false)
    setContacts([])
  }

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), name: '', description: '', quantity: 1, rate: 0, unit: 'kg' }
    ])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const calculateItemTotal = (item: LineItem) => {
    return item.quantity * item.rate
  }

  const calculateSubTotal = () => {
    return lineItems.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }

  const calculateGrandTotal = () => {
    return calculateSubTotal() + (formData.shipping_charge || 0)
  }

  const resetForm = () => {
    setFormData({
      customer_id: '',
      customer_name: '',
      date: new Date().toISOString().split('T')[0],
      reference_number: '',
      shipping_charge: 0,
    })
    setLineItems([
      { id: '1', name: '', description: '', quantity: 1, rate: 0, unit: 'kg' }
    ])
    setCustomerSearch('')
    setContacts([])
    setShowDropdown(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.customer_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a customer from the search results",
      })
      return
    }

    const validItems = lineItems.filter(item => item.name.trim() && item.rate > 0)
    if (validItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add at least one item with name and rate",
      })
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/zoho/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: formData.customer_id,
          date: formData.date,
          reference_number: formData.reference_number,
          line_items: validItems.map(item => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            unit: item.unit,
          })),
          shipping_charge: formData.shipping_charge,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      toast({
        title: "Invoice Created",
        description: `Invoice ${data.invoice?.invoice_number || ''} has been created successfully`,
      })
      
      resetForm()
      onSuccess()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create invoice",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice in Zoho Books
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer & Date Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Customer Search */}
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    value={customerSearch}
                    onChange={(e) => handleCustomerInputChange(e.target.value)}
                    onFocus={() => customerSearch.length >= 2 && !formData.customer_id && setShowDropdown(true)}
                    placeholder="Type to search customers..."
                    className={`pl-10 ${formData.customer_id ? 'border-green-500 bg-green-500/10' : ''}`}
                  />
                  {formData.customer_id && (
                    <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
                
                {/* Dropdown Results */}
                {showDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {isSearchingContacts ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Searching...</span>
                      </div>
                    ) : contacts.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        {customerSearch.length < 2 
                          ? "Type at least 2 characters to search" 
                          : "No customers found"
                        }
                      </div>
                    ) : (
                      <div className="py-1">
                        {contacts.map((contact) => (
                          <button
                            key={contact.contact_id}
                            type="button"
                            onClick={() => handleSelectCustomer(contact)}
                            className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <div className="font-medium">{contact.contact_name}</div>
                            {contact.phone && (
                              <div className="text-xs text-muted-foreground">{contact.phone}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {formData.customer_id && (
                <p className="text-xs text-green-600">✓ Customer selected</p>
              )}
            </div>

            {/* Invoice Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Invoice Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Order Number */}
          <div className="space-y-2">
            <Label htmlFor="reference_number">Order Number</Label>
            <Input
              id="reference_number"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              placeholder="e.g., ORD-001234"
            />
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Item Name</th>
                    <th className="text-left p-3 text-sm font-medium">Description</th>
                    <th className="text-right p-3 text-sm font-medium w-24">Qty</th>
                    <th className="text-right p-3 text-sm font-medium w-32">Unit Price</th>
                    <th className="text-right p-3 text-sm font-medium w-32">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">
                        <Input
                          value={item.name}
                          onChange={(e) => updateLineItem(item.id, 'name', e.target.value)}
                          placeholder="Item name"
                          className="h-9"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="Description"
                          className="h-9"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantity || ''}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="h-9 text-right"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.rate || ''}
                          onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="h-9 text-right"
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        <div className="flex items-center justify-end h-9">
                          <IndianRupee className="h-3 w-3 mr-1" />
                          {calculateItemTotal(item).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                          className="h-9 w-9 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sub Total:</span>
                <span className="font-medium">
                  <IndianRupee className="h-3 w-3 inline mr-1" />
                  {calculateSubTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span>Shipping Charge:</span>
                <div className="flex items-center">
                  <IndianRupee className="h-3 w-3 mr-1" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.shipping_charge || ''}
                    onChange={(e) => setFormData({ ...formData, shipping_charge: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-24 text-right"
                  />
                </div>
              </div>
              
              <div className="flex justify-between text-base font-semibold border-t pt-2">
                <span>Grand Total:</span>
                <span>
                  <IndianRupee className="h-4 w-4 inline mr-1" />
                  {calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
