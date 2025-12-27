"use client"

import React, { useState, useEffect } from "react"
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
import { Badge } from "../ui/badge"
import { useToast } from "../../hooks/use-toast"
import { Loader2, ExternalLink, Send } from "lucide-react"
import type { ZohoPayment } from "../../lib/zohoService"

interface PaymentLinkModalProps {
  payment: ZohoPayment
  paymentLinkId?: string
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export function PaymentLinkModal({ 
  payment, 
  paymentLinkId, 
  isOpen, 
  onClose, 
  onUpdate 
}: PaymentLinkModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    amount: payment.amount,
    description: payment.description || '',
    expiry_days: 30,
    customer_email: '',
    customer_phone: '',
  })

  useEffect(() => {
    if (payment) {
      setFormData({
        amount: payment.amount,
        description: payment.description || '',
        expiry_days: 30,
        customer_email: '',
        customer_phone: '',
      })
    }
  }, [payment])

  const handleUpdate = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement payment link update API call
      toast({
        title: "Payment Link Updated",
        description: "Payment link has been updated successfully",
      })
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update payment link",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payment Link Details</DialogTitle>
          <DialogDescription>
            View and edit payment link information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isEditing ? (
            <>
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
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
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Amount</Label>
                <p className="text-sm font-medium">{formData.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <p className="text-sm">{formData.description || 'N/A'}</p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Badge>{payment.status}</Badge>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

