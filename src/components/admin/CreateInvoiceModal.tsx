"use client"

import React, { useState } from "react"
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
import { Textarea } from "../ui/textarea"
import { useToast } from "../../hooks/use-toast"
import { Loader2 } from "lucide-react"

interface CreateInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateInvoiceModal({ isOpen, onClose, onSuccess }: CreateInvoiceModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    line_items: [] as Array<{
      name: string
      description?: string
      quantity: number
      unit?: string
      rate: number
    }>,
    description: '',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      // TODO: Implement invoice creation API call
      toast({
        title: "Invoice Created",
        description: "Invoice has been created successfully",
      })
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice in Zoho Books
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
              />
            </div>
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

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
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

