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
import { useToast } from "../../hooks/use-toast"
import { Loader2, Copy, Check, ExternalLink } from "lucide-react"

interface CreatePaymentLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface CreatedPaymentLink {
  payment_link_id: string
  url: string
  payment_link_url?: string // Zoho might return either
  amount: number | string
  status: string
}

export function CreatePaymentLinkModal({ isOpen, onClose, onSuccess }: CreatePaymentLinkModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [createdLink, setCreatedLink] = useState<CreatedPaymentLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [formData, setFormData] = useState({
    amount: 0,
    description: '',
    currency: 'INR',
    expiry_days: 30,
  })

  const resetModal = () => {
    setFormData({
      amount: 0,
      description: '',
      currency: 'INR',
      expiry_days: 30,
    })
    setCreatedLink(null)
    setCopied(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment link')
      }

      // Store the created payment link details
      // Handle different response structures from Zoho API
      const paymentLinkData = data.payment_link || data.payment_links || data
      
      // Zoho returns 'url' field, normalize it
      const normalizedLink: CreatedPaymentLink = {
        payment_link_id: paymentLinkData.payment_link_id || '',
        url: paymentLinkData.url || paymentLinkData.payment_link_url || '',
        amount: parseFloat(paymentLinkData.amount) || formData.amount,
        status: paymentLinkData.status || 'active',
      }
      
      if (!normalizedLink.url) {
        throw new Error('Payment link URL not found in response')
      }
      
      setCreatedLink(normalizedLink)
      
      toast({
        title: "Payment Link Created",
        description: "Copy the link below to share with your customer",
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

  const handleCopyLink = async () => {
    if (createdLink?.url) {
      try {
        await navigator.clipboard.writeText(createdLink.url)
        setCopied(true)
        toast({
          title: "Copied!",
          description: "Payment link copied to clipboard",
        })
        // Reset copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to copy link",
        })
      }
    }
  }

  const handleDone = () => {
    onSuccess()
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {createdLink ? "Payment Link Created!" : "Create Payment Link"}
          </DialogTitle>
          <DialogDescription>
            {createdLink 
              ? "Your payment link is ready. Copy and share it with your customer."
              : "Create a new payment link in Zoho Payments"
            }
          </DialogDescription>
        </DialogHeader>
        
        {createdLink ? (
          // Success state - show the generated link
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  ₹{(typeof createdLink.amount === 'string' ? parseFloat(createdLink.amount) : createdLink.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Payment Link</Label>
                <div className="flex gap-2">
                  <Input 
                    value={createdLink.url} 
                    readOnly 
                    className="font-mono text-sm bg-background"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => window.open(createdLink.url, '_blank')}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleCopyLink} variant="outline">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button onClick={handleDone}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Form state - create new link
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter amount"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Payment for Order #123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry_days">Link Expiry (Days)</Label>
              <Input
                id="expiry_days"
                type="number"
                min="1"
                max="365"
                value={formData.expiry_days}
                onChange={(e) => setFormData({ ...formData, expiry_days: parseInt(e.target.value) || 30 })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !formData.amount}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Payment Link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
