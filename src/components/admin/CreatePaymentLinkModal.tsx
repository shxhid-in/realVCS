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

interface CreatePaymentLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreatePaymentLinkModal({ isOpen, onClose, onSuccess }: CreatePaymentLinkModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    amount: 0,
    description: '',
    currency: 'INR',
    email: '',
    phone: '',
    expiry_days: 30,
    invoice_id: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/zoho/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to create payment link')
      }

      toast({
        title: "Payment Link Created",
        description: "Payment link has been created successfully",
      })
      onSuccess()
      // Reset form
      setFormData({
        amount: 0,
        description: '',
        currency: 'INR',
        email: '',
        phone: '',
        expiry_days: 30,
        invoice_id: '',
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create payment link",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Payment Link</DialogTitle>
          <DialogDescription>
            Create a new payment link in Zoho Payments
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Input
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Customer Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Customer Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry_days">Expiry Days</Label>
            <Input
              id="expiry_days"
              type="number"
              value={formData.expiry_days}
              onChange={(e) => setFormData({ ...formData, expiry_days: parseInt(e.target.value) })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Payment Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

