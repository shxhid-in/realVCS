"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Badge } from "../ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useToast } from "../../hooks/use-toast"
import { 
  IndianRupee, 
  Save, 
  X, 
  Edit,
  Package,
  Calendar,
  User,
  MapPin,
  Weight,
  Trash2,
  Plus
} from "lucide-react"
import { format } from "date-fns"
import type { Order, OrderItem } from "../../lib/types"
import { extractEnglishName } from "../../lib/butcherConfig"

interface OrderEditModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export function OrderEditModal({ order, isOpen, onClose, onUpdate }: OrderEditModalProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [editedOrder, setEditedOrder] = useState<Order | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (order) {
      setEditedOrder({ ...order })
      setIsEditing(false)
    }
  }, [order])

  if (!order || !editedOrder) return null

  const handleSave = async () => {
    if (!editedOrder.butcherId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Butcher ID is required to save order",
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/orders/${editedOrder.butcherId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedOrder),
      })

      if (response.ok) {
        toast({
          title: "Order Updated",
          description: "Order has been updated successfully",
        })
        setIsEditing(false)
        onUpdate()
        onClose()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update order')
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update order",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (order) {
      setEditedOrder({ ...order })
    }
    setIsEditing(false)
  }

  const updateOrderField = (field: keyof Order, value: any) => {
    setEditedOrder(prev => prev ? { ...prev, [field]: value } : null)
  }

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setEditedOrder(prev => {
      if (!prev) return null
      const newItems = [...prev.items]
      newItems[index] = { ...newItems[index], [field]: value }
      return { ...prev, items: newItems }
    })
  }

  const addItem = () => {
    setEditedOrder(prev => {
      if (!prev) return null
      const newItem: OrderItem = {
        id: `item-${Date.now()}`,
        name: '',
        quantity: 0,
        unit: 'kg',
      }
      return { ...prev, items: [...prev.items, newItem] }
    })
  }

  const removeItem = (index: number) => {
    setEditedOrder(prev => {
      if (!prev) return null
      const newItems = prev.items.filter((_, i) => i !== index)
      return { ...prev, items: newItems }
    })
  }

  const statusOptions = [
    { value: 'new', label: 'New' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'prepared', label: 'Prepared' },
    { value: 'completed', label: 'Completed' },
    { value: 'ready to pick up', label: 'Ready to Pick Up' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </DialogTitle>
              <DialogDescription>
                Order ID: {editedOrder.id}
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
                  <Button variant="outline" onClick={handleCancel}>
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
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderId">Order ID</Label>
              <Input
                id="orderId"
                value={editedOrder.id}
                disabled={!isEditing}
                onChange={(e) => updateOrderField('id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              {isEditing ? (
                <Select
                  value={editedOrder.status}
                  onValueChange={(value) => updateOrderField('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="text-sm py-2 px-3">
                  {statusOptions.find(opt => opt.value === editedOrder.status)?.label || editedOrder.status}
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={editedOrder.customerName || ''}
                disabled={!isEditing}
                onChange={(e) => updateOrderField('customerName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderTime">Order Time</Label>
              <Input
                id="orderTime"
                type="datetime-local"
                value={editedOrder.orderTime ? (() => {
                  const date = new Date(editedOrder.orderTime)
                  const year = date.getFullYear()
                  const month = String(date.getMonth() + 1).padStart(2, '0')
                  const day = String(date.getDate()).padStart(2, '0')
                  const hours = String(date.getHours()).padStart(2, '0')
                  const minutes = String(date.getMinutes()).padStart(2, '0')
                  return `${year}-${month}-${day}T${hours}:${minutes}`
                })() : ''}
                disabled={!isEditing}
                onChange={(e) => {
                  const dateValue = e.target.value
                  if (dateValue) {
                    updateOrderField('orderTime', new Date(dateValue))
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="butcherId">Butcher ID</Label>
              <Input
                id="butcherId"
                value={editedOrder.butcherId || ''}
                disabled={!isEditing}
                onChange={(e) => updateOrderField('butcherId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue (₹)</Label>
              <Input
                id="revenue"
                type="number"
                step="0.01"
                value={editedOrder.revenue || 0}
                disabled={!isEditing}
                onChange={(e) => updateOrderField('revenue', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickedWeight">Picked Weight</Label>
              <Input
                id="pickedWeight"
                type="number"
                step="0.01"
                value={editedOrder.pickedWeight || ''}
                disabled={!isEditing}
                onChange={(e) => updateOrderField('pickedWeight', parseFloat(e.target.value) || undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finalWeight">Final Weight</Label>
              <Input
                id="finalWeight"
                type="number"
                step="0.01"
                value={editedOrder.finalWeight || ''}
                disabled={!isEditing}
                onChange={(e) => updateOrderField('finalWeight', parseFloat(e.target.value) || undefined)}
              />
            </div>
            {editedOrder.address && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={editedOrder.address}
                  disabled={!isEditing}
                  onChange={(e) => updateOrderField('address', e.target.value)}
                />
              </div>
            )}
            {editedOrder.rejectionReason && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="rejectionReason">Rejection Reason</Label>
                <Textarea
                  id="rejectionReason"
                  value={editedOrder.rejectionReason}
                  disabled={!isEditing}
                  onChange={(e) => updateOrderField('rejectionReason', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">Order Items</Label>
              {isEditing && (
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {editedOrder.items.map((item, index) => (
                <div key={item.id || index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Item Name</Label>
                        <Input
                          value={item.name}
                          disabled={!isEditing}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          placeholder="Item name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          disabled={!isEditing}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit</Label>
                        {isEditing ? (
                          <Select
                            value={item.unit}
                            onValueChange={(value) => updateItem(index, 'unit', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="nos">nos</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={item.unit} disabled />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Size</Label>
                        <Input
                          value={item.size || ''}
                          disabled={!isEditing}
                          onChange={(e) => updateItem(index, 'size', e.target.value)}
                          placeholder="Size (optional)"
                        />
                      </div>
                      {item.cutType && (
                        <div className="space-y-2 md:col-span-2">
                          <Label>Cut Type</Label>
                          <Input
                            value={item.cutType}
                            disabled={!isEditing}
                            onChange={(e) => updateItem(index, 'cutType', e.target.value)}
                            placeholder="Cut type (optional)"
                          />
                        </div>
                      )}
                    </div>
                    {isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="ml-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Item Revenues (if available) */}
          {editedOrder.itemRevenues && Object.keys(editedOrder.itemRevenues).length > 0 && (
            <div className="space-y-2">
              <Label className="text-lg font-semibold">Item Revenues</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(editedOrder.itemRevenues).map(([itemName, revenue]) => (
                  <div key={itemName} className="flex justify-between items-center p-2 border rounded">
                    <span className="text-sm">{extractEnglishName(itemName)}</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={revenue}
                        onChange={(e) => {
                          const newItemRevenues = { ...editedOrder.itemRevenues }
                          newItemRevenues[itemName] = parseFloat(e.target.value) || 0
                          updateOrderField('itemRevenues', newItemRevenues)
                        }}
                        className="w-24"
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        <IndianRupee className="h-3 w-3 inline mr-1" />
                        {revenue.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

