"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Badge } from "../ui/badge"
import { useToast } from "../../hooks/use-toast"
import { 
  IndianRupee, 
  Save, 
  Edit
} from "lucide-react"
import { format } from "date-fns"
import type { ZohoInvoice } from "../../lib/zohoService"

interface InvoiceModalProps {
  invoice: ZohoInvoice
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export function InvoiceModal({ invoice, isOpen, onClose, onUpdate }: InvoiceModalProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [editedInvoice, setEditedInvoice] = useState<ZohoInvoice>(invoice)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (invoice) {
      setEditedInvoice(invoice)
    }
  }, [invoice])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/zoho/invoices?invoice_id=${invoice.invoice_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedInvoice),
      })

      if (response.ok) {
        toast({
          title: "Invoice Updated",
          description: "Invoice has been updated successfully",
        })
        setIsEditing(false)
        onUpdate()
      } else {
        throw new Error('Failed to update invoice')
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update invoice",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl">Invoice Details</DialogTitle>
              <DialogDescription>
                Invoice #{editedInvoice.invoice_number}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Invoice Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Customer</Label>
              {isEditing ? (
                <Input
                  value={editedInvoice.customer_name}
                  onChange={(e) => setEditedInvoice({ ...editedInvoice, customer_name: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="font-medium mt-1">{editedInvoice.customer_name}</p>
              )}
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={editedInvoice.date}
                  onChange={(e) => setEditedInvoice({ ...editedInvoice, date: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="font-medium mt-1">
                  {format(new Date(editedInvoice.date), 'MMM dd, yyyy')}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={editedInvoice.status === 'paid' ? 'default' : 'secondary'}>
                  {editedInvoice.status}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Total Amount</Label>
              {isEditing ? (
                <Input
                  type="number"
                  value={editedInvoice.total}
                  onChange={(e) => setEditedInvoice({ ...editedInvoice, total: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              ) : (
                <p className="font-medium mt-1">
                  <IndianRupee className="h-4 w-4 inline mr-1" />
                  {editedInvoice.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Items</Label>
            <div className="border rounded-lg">
              <div className="divide-y">
                {editedInvoice.line_items?.map((item, index) => (
                  <div key={index} className="p-4">
                    {isEditing ? (
                      <div className="grid grid-cols-4 gap-4">
                        <Input
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...(editedInvoice.line_items || [])]
                            newItems[index] = { ...item, name: e.target.value }
                            setEditedInvoice({ ...editedInvoice, line_items: newItems })
                          }}
                          placeholder="Item name"
                        />
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...(editedInvoice.line_items || [])]
                            newItems[index] = { ...item, quantity: parseFloat(e.target.value) }
                            setEditedInvoice({ ...editedInvoice, line_items: newItems })
                          }}
                          placeholder="Quantity"
                        />
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => {
                            const newItems = [...(editedInvoice.line_items || [])]
                            newItems[index] = { ...item, rate: parseFloat(e.target.value) }
                            setEditedInvoice({ ...editedInvoice, line_items: newItems })
                          }}
                          placeholder="Rate"
                        />
                        <div className="flex items-center">
                          <IndianRupee className="h-4 w-4 mr-1" />
                          <span className="font-medium">
                            {(item.quantity * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} {item.unit || 'kg'} × 
                            <IndianRupee className="h-3 w-3 inline mx-1" />
                            {item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <p className="font-medium">
                          <IndianRupee className="h-4 w-4 inline mr-1" />
                          {item.item_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes/Description */}
          {(editedInvoice.notes || editedInvoice.description) && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Notes</Label>
              {isEditing ? (
                <Textarea
                  value={editedInvoice.notes || editedInvoice.description || ''}
                  onChange={(e) => setEditedInvoice({ ...editedInvoice, notes: e.target.value })}
                  rows={3}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {editedInvoice.notes || editedInvoice.description}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
