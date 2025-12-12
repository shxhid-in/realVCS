"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { getFishItemFullName, freshButchers, getButcherType, isFishButcher, getCommissionRate, findCategoryForItem, getItemTypeFromCategory } from '../../lib/butcherConfig';
import { getRatesFromSheet } from '../../lib/sheets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Clock, X, Package, Timer, AlertTriangle, Loader2, ThumbsUp, ThumbsDown, MapPin, Weight, IndianRupee, PackageCheck, CookingPot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Order, OrderItem } from '@/lib/types';
import { useOrderCache } from '@/hooks/useOrderCache';
import { Skeleton } from '@/components/ui/skeleton';

// Helper function to determine if a butcher is a meat butcher (uses getButcherType)
function isMeatButcher(butcherId: string): boolean {
    return getButcherType(butcherId) === 'meat';
}

// Helper function to determine if a chicken item needs weight dialog
function needsWeightDialog(itemName: string): boolean {
    const itemNameLower = itemName.toLowerCase();
    return itemNameLower.includes('chicken nadan') || 
           itemNameLower.includes('chicken thigh') ||
           itemNameLower.includes('nadan') ||
           itemNameLower.includes('thigh');
}

// Helper function to check if an item needs weight entry
// For meat items: skip weight (except chicken nadan/thigh)
// For fish items: always require weight
function itemNeedsWeight(butcherId: string, itemName: string): boolean {
    // First check if it's a special case that always needs weight (chicken nadan/thigh)
    if (needsWeightDialog(itemName)) {
        return true;
    }
    
    // Check if item is a meat item by finding its category
    const category = findCategoryForItem(butcherId, itemName);
    if (category) {
        const itemType = getItemTypeFromCategory(category);
        // If it's a meat item, it doesn't need weight (exception already handled above)
        if (itemType === 'meat') {
            return false;
        }
        // If it's a fish item, it needs weight
        if (itemType === 'fish') {
            return true;
        }
    }
    
    // Fallback: for pure meat butchers, don't require weight
    // For fish/mixed butchers, require weight if category not found
    return !isMeatButcher(butcherId);
}

// Helper function to get the correct weight to display
function getDisplayWeight(order: Order, butcherId: string): number {
    if (isMeatButcher(butcherId)) {
        // For meat butchers, use itemQuantities if available, otherwise use pickedWeight
        if (order.itemQuantities && Object.keys(order.itemQuantities).length > 0) {
            const totalWeight = Object.values(order.itemQuantities).reduce((sum, weight) => sum + parseFloat(weight), 0);
            return totalWeight;
        }
    } else {
        // For fish butchers, use itemWeights if available, otherwise use pickedWeight
        if (order.itemWeights && Object.keys(order.itemWeights).length > 0) {
            const totalWeight = Object.values(order.itemWeights).reduce((sum, weight) => sum + parseFloat(weight), 0);
            return totalWeight;
        }
    }
    // Fallback to pickedWeight
    return order.pickedWeight || 0;
}

// Helper function to get display order ID
function getDisplayOrderId(orderId: string): string {
    return orderId.replace('ORD-', '');
}

// Helper function to get item display name
function getItemDisplayName(itemName: string, butcherId: string): string {
    // For fish butchers, show full three-language name (manglish - english - malayalam)
    if (isFishButcher(butcherId)) {
        // If already has three-language format, return as is
        if (itemName.includes(' - ') && itemName.split(' - ').length >= 3) {
            return itemName;
        }
        // If only has single name, try to convert to three-language format
        return getFishItemFullName(itemName);
    }
    // For meat butchers, just return the single name
    return itemName;
}

// Countdown Timer Component
const CountdownTimer = ({ startTime, orderStatus }: { startTime: Date; orderStatus: string }) => {
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isOverdue, setIsOverdue] = useState(false);

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const elapsed = now.getTime() - startTime.getTime();
            const remaining = Math.max(0, (20 * 60 * 1000) - elapsed); // 20 minutes in milliseconds
            
            setTimeLeft(remaining);
            setIsOverdue(remaining === 0);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    if (orderStatus !== 'preparing') return null;

    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium",
            isOverdue 
                ? "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" 
                : "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
        )}>
            <Timer className="h-4 w-4" />
            {isOverdue ? 'Overdue' : `${minutes}:${seconds.toString().padStart(2, '0')}`}
        </div>
    );
};

// Skeleton Order Card Component for Optimistic Updates
const SkeletonOrderCard = ({ order }: { order: Order }) => {
    return (
        <Card className="bg-white dark:bg-gray-900 border-l-4 border-orange-500 opacity-75">
            <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-md" />
                </div>
            </CardHeader>
            <CardContent className="space-y-3 py-3">
                <div className="space-y-2">
                    {order.items.map((item, index) => (
                        <div key={item.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-16 rounded-full" />
                                <Skeleton className="h-4 w-20 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="pt-2 pb-3 px-4">
                <div className="flex justify-end gap-2 w-full">
                    <Skeleton className="h-8 w-20" />
                </div>
            </CardFooter>
        </Card>
    );
};

// Reject Dialog Component
const RejectDialog = ({ 
    order, 
    rejectDialogState, 
    updateRejectDialogState, 
    handleReject, 
    handleRejectConfirm 
}: {
    order: Order;
    rejectDialogState: { isOpen: boolean; reason: string };
    updateRejectDialogState: (updates: any) => void;
    handleReject: () => void;
    handleRejectConfirm: () => void;
}) => {
    return (
        <Dialog open={rejectDialogState.isOpen} onOpenChange={(open) => updateRejectDialogState({ isOpen: open })}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reject Order</DialogTitle>
                    <DialogDescription>
                        Please provide a reason for rejecting order {getDisplayOrderId(order.id)}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="reject-reason">Reason for rejection</Label>
                        <Textarea
                            id="reject-reason"
                            placeholder="Enter reason for rejecting this order..."
                            value={rejectDialogState.reason}
                            onChange={(e) => updateRejectDialogState({ reason: e.target.value })}
                            className="mt-2"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleReject}>
                        Cancel
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleRejectConfirm}
                        disabled={!rejectDialogState.reason.trim()}
                    >
                        Reject Order
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Weight Dialog Component
const ItemAcceptDialog = ({
    order,
    dialogState,
    updateDialogState,
    handleItemAccept,
    handleItemCancel,
    butcherId
}: {
    order: Order;
    dialogState: { isOpen: boolean; currentIndex: number };
    updateDialogState: (updates: any) => void;
    handleItemAccept: () => void;
    handleItemCancel: () => void;
    butcherId: string;
}) => {
    const currentItem = order.items[dialogState.currentIndex];
    if (!currentItem) return null;

    return (
        <Dialog open={dialogState.isOpen} onOpenChange={(open) => updateDialogState({ isOpen: open })}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Accept or Reject Item</DialogTitle>
                    <DialogDescription>
                        Item {dialogState.currentIndex + 1} of {order.items.length}: {getItemDisplayName(currentItem.name, butcherId)}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                        <p className="text-sm font-medium">Item: <span className="font-semibold">{getItemDisplayName(currentItem.name, butcherId)}</span></p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="font-medium">Order Quantity:</span> {currentItem.quantity}{currentItem.unit}
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="destructive" 
                        onClick={() => {
                            // Open item rejection dialog - need to update parent dialog state
                            // We'll pass this through handleItemCancel's updateDialogState
                            updateDialogState({
                                itemRejectDialog: {
                                    isOpen: true,
                                    reason: '',
                                    itemId: currentItem.id
                                }
                            });
                        }}
                    >
                        Reject Item
                    </Button>
                    <Button 
                        onClick={handleItemAccept}
                    >
                        {(() => {
                            // Check if this is the last item that doesn't need weight
                            const remainingItems = order.items.slice(dialogState.currentIndex + 1).filter(item => !itemNeedsWeight(butcherId, item.name));
                            return remainingItems.length > 0 ? 'Next Item' : 'Complete';
                        })()}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const WeightDialog = ({ 
    order, 
    dialogState, 
    updateDialogState, 
    handleWeightSubmit, 
    handleWeightCancel,
    butcherId
}: {
    order: Order;
    dialogState: { isOpen: boolean; weights: {[itemName: string]: string}; rejectedItems: {[itemName: string]: string}; unit: 'kg' | 'nos'; currentIndex: number; itemRejectDialog?: any };
    updateDialogState: (updates: any) => void;
    handleWeightSubmit: () => void;
    handleWeightCancel: () => void;
    butcherId: string;
}) => {
    const currentItem = order.items[dialogState.currentIndex];
    if (!currentItem) return null;

    // Determine if item uses 'nos' (pieces) or 'kg' (weight)
    // Check item unit from order
    const itemUnit = currentItem.unit || 'kg'; // Default to kg if not specified
    const isNosUnit = itemUnit === 'nos';
    
    // If unit is 'nos', force unit to 'nos', otherwise use dialogState.unit (kg)
    const displayUnit = isNosUnit ? 'nos' : (dialogState.unit || 'kg');

    // Maximum limits: 10.0 kg for weight, 20 nos for quantity
    const MAX_WEIGHT_KG = 10.0;
    const MAX_QUANTITY_NOS = 20;

    const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        
        // For 'nos' unit: only allow whole numbers
        if (displayUnit === 'nos') {
            // Remove any decimal points or non-numeric characters except empty
            const wholeNumber = value.replace(/[^0-9]/g, '');
            if (wholeNumber === '' || parseInt(wholeNumber) >= 0) {
                updateDialogState({
                    weights: {
                        ...dialogState.weights,
                        [currentItem.name]: wholeNumber
                    }
                });
            }
        } else {
            // For 'kg' unit: allow rational numbers (decimals)
            // Allow empty, numbers, and one decimal point
            const decimalNumber = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
            if (decimalNumber === '' || !isNaN(parseFloat(decimalNumber))) {
                updateDialogState({
                    weights: {
                        ...dialogState.weights,
                        [currentItem.name]: decimalNumber
                    }
                });
            }
        }
    };

    const validateWeight = (): { isValid: boolean; errorMessage: string | null } => {
        const weight = dialogState.weights[currentItem.name];
        if (!weight || weight.trim() === '') {
            return { isValid: false, errorMessage: null };
        }
        
        if (displayUnit === 'nos') {
            // Must be whole number >= 1 and <= 20
            const num = parseInt(weight);
            if (isNaN(num) || num < 1 || num % 1 !== 0) {
                return { isValid: false, errorMessage: null };
            }
            if (num > MAX_QUANTITY_NOS) {
                return { isValid: false, errorMessage: 'Enter a valid weight' };
            }
            return { isValid: true, errorMessage: null };
        } else {
            // Must be positive number (rational or whole) and <= 10.0
            const num = parseFloat(weight);
            if (isNaN(num) || num <= 0) {
                return { isValid: false, errorMessage: null };
            }
            if (num > MAX_WEIGHT_KG) {
                return { isValid: false, errorMessage: 'Enter a valid weight' };
            }
            return { isValid: true, errorMessage: null };
        }
    };

    const validation = validateWeight();

    return (
        <Dialog open={dialogState.isOpen} onOpenChange={(open) => updateDialogState({ isOpen: open })}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Enter {displayUnit === 'nos' ? 'Quantity' : 'Weight'}</DialogTitle>
                    <DialogDescription>
                        Item {dialogState.currentIndex + 1} of {order.items.length}: {getItemDisplayName(currentItem.name, butcherId)}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                        <p className="text-sm font-medium">Item: <span className="font-semibold">{getItemDisplayName(currentItem.name, butcherId)}</span></p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="font-medium">Order {currentItem.unit === 'nos' ? 'Quantity' : 'Weight'}:</span> {currentItem.quantity}{currentItem.unit}
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="weight">
                            {displayUnit === 'nos' ? 'Preparing Quantity (pieces)' : 'Preparing Weight (kilograms)'}
                        </Label>
                        <Input
                            id="weight"
                            type="text"
                            inputMode={displayUnit === 'nos' ? 'numeric' : 'decimal'}
                            step={displayUnit === 'nos' ? '1' : '0.01'}
                            placeholder={displayUnit === 'nos' ? 'Enter quantity (whole number)' : 'Enter weight (e.g., 1.5 or 2)'}
                            value={dialogState.weights[currentItem.name] || ''}
                            onChange={handleWeightChange}
                            className={cn(
                                "mt-2",
                                validation.errorMessage && "border-red-500 focus-visible:ring-red-500"
                            )}
                        />
                        {validation.errorMessage ? (
                            <p className="text-xs text-red-500 mt-1 font-medium">
                                {validation.errorMessage}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500 mt-1">
                                {displayUnit === 'nos' 
                                    ? `Enter quantity` 
                                    : `Enter weight in kilograms`}
                            </p>
                        )}
                    </div>
                    {!isNosUnit && (
                    <div>
                        <Label htmlFor="unit">Unit</Label>
                        <Select 
                                value={displayUnit} 
                                onValueChange={(value: 'kg' | 'nos') => updateDialogState({ unit: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="kg">Kilograms (kg)</SelectItem>
                                    <SelectItem value="nos">Pieces (nos)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="destructive" 
                        onClick={() => {
                            // Open item rejection dialog
                            updateDialogState({
                                itemRejectDialog: {
                                    isOpen: true,
                                    reason: '',
                                    itemId: currentItem.id
                                }
                            });
                        }}
                    >
                        Reject Item
                    </Button>
                    <Button 
                        onClick={handleWeightSubmit}
                        disabled={(() => {
                            // If dialog is shown, weight is ALWAYS required
                            const needsWeight = itemNeedsWeight(butcherId, currentItem.name);
                            if (needsWeight) {
                                return !validation.isValid;
                            }
                            // This should never happen since dialog only shows for items that need weight
                            return true;
                        })()}
                    >
                        {(() => {
                            // Check if this is the last item that needs weight
                            if (isMeatButcher(butcherId)) {
                                const remainingNeedsWeight = order.items.slice(dialogState.currentIndex + 1).some(item => itemNeedsWeight(butcherId, item.name));
                                return remainingNeedsWeight ? 'Next Item' : 'Complete';
                            }
                            return dialogState.currentIndex === order.items.length - 1 ? 'Complete' : 'Next Item';
                        })()}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// OrderCard Component
const OrderCard = ({ 
    order, 
    onUpdate, 
    butcherId, 
    isArchived, 
    butcherMenu, 
    refetch, 
    allOrders, 
    globalDialogState, 
    setGlobalDialogState, 
    setCurrentDialogOrder,
    setOptimisticTransitions
}: {
    order: Order;
    onUpdate: (updatedOrder: Order) => Promise<void>;
    butcherId: string;
    isArchived?: boolean;
    butcherMenu?: any;
    refetch: () => Promise<void>;
    allOrders: Order[];
    globalDialogState: any;
    setGlobalDialogState: (updater: any) => void;
    setCurrentDialogOrder: (order: Order | null) => void;
    setOptimisticTransitions: (updater: any) => void;
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    
    // ✅ FIX: Ref to store latest dialog state to avoid stale reads
    const dialogStateRef = useRef<{ [orderId: string]: any }>({});
    
    // Check if this order has a pending operation
    const isPending = pendingOperations.has(order.id);

    // Check if order is overdue
    const isOverdue = order.status === 'preparing' && order.preparationStartTime && 
                      (Date.now() - order.preparationStartTime.getTime()) > (20 * 60 * 1000);
    
    // Get dialog state for this specific order from global state
    // ✅ FIX: Also check ref for latest state (avoids stale reads)
    const dialogState = dialogStateRef.current[order.id] || globalDialogState[order.id] || {
        isOpen: false,
        weights: {},
        rejectedItems: {},
        unit: 'kg' as const,
        currentIndex: 0,
        itemAcceptDialog: { isOpen: false, currentIndex: 0 }
    };
    
    // ✅ FIX: Sync ref with current global state (initialize and keep in sync)
    useEffect(() => {
        if (globalDialogState[order.id]) {
            dialogStateRef.current[order.id] = globalDialogState[order.id];
        } else if (!dialogStateRef.current[order.id]) {
            // Initialize ref with default state if not set
            dialogStateRef.current[order.id] = {
                isOpen: false,
                weights: {},
                rejectedItems: {},
                unit: 'kg' as const,
                currentIndex: 0,
                itemAcceptDialog: { isOpen: false, currentIndex: 0 }
            };
        }
    }, [globalDialogState, order.id]);

    const itemAcceptDialogState = globalDialogState[order.id]?.itemAcceptDialog || {
        isOpen: false,
        currentIndex: 0
    };

    const rejectDialogState = globalDialogState[order.id]?.rejectDialog || {
        isOpen: false,
        reason: ''
    };
    
    const itemRejectDialogState = globalDialogState[order.id]?.itemRejectDialog || {
        isOpen: false,
        reason: '',
        itemId: ''
    };
    
    // Helper function to update dialog state
    // ✅ FIX: Use functional update and also update ref immediately
    const updateDialogState = (updates: Partial<typeof dialogState>) => {
        setGlobalDialogState((prev: any) => {
            const updatedState = {
                ...(prev[order.id] || dialogState),  // Use prev state, fallback to current
                ...updates
            };
            // ✅ FIX: Store in ref immediately for synchronous access
            dialogStateRef.current[order.id] = updatedState;
            return {
                ...prev,
                [order.id]: updatedState
            };
        });
    };

    const updateRejectDialogState = (updates: any) => {
        setGlobalDialogState((prev: any) => {
            const updatedState = {
                ...prev[order.id],
                rejectDialog: {
                    ...rejectDialogState,
                    ...updates
                }
            };
            // ✅ FIX: Store in ref immediately for synchronous access
            dialogStateRef.current[order.id] = {
                ...(dialogStateRef.current[order.id] || dialogState),
                ...updatedState
            };
            return {
                ...prev,
                [order.id]: updatedState
            };
        });
    };
    
    const updateItemRejectDialogState = (updates: any) => {
        setGlobalDialogState((prev: any) => {
            const updatedState = {
                ...prev[order.id],
                itemRejectDialog: {
                    ...itemRejectDialogState,
                    ...updates
                }
            };
            // ✅ FIX: Store in ref immediately for synchronous access
            dialogStateRef.current[order.id] = {
                ...(dialogStateRef.current[order.id] || dialogState),
                ...updatedState
            };
            return {
                ...prev,
                [order.id]: updatedState
            };
        });
    };

    const getStatusStyling = () => {
        switch (order.status) {
            case 'new':
                return {
                    cardClass: "border-l-4 border-blue-500",
                    statusClass: "bg-blue-500 text-white",
                    icon: Clock,
                    pulse: true
                };
            case 'preparing':
                return {
                    cardClass: "border-l-4 border-orange-500",
                    statusClass: "bg-orange-500 text-white",
                    icon: Timer,
                    pulse: true
                };
            case 'prepared':
                return {
                    cardClass: "border-l-4 border-green-500",
                    statusClass: "bg-green-500 text-white",
                    icon: CheckCircle,
                    pulse: false
                };
            case 'completed':
                return {
                    cardClass: "border-l-4 border-emerald-500",
                    statusClass: "bg-emerald-500 text-white",
                    icon: CheckCircle,
                    pulse: false
                };
            case 'rejected':
                return {
                    cardClass: isArchived 
                        ? "border-l-4 border-red-500 bg-red-950/20 dark:bg-red-900/30 border-red-500/50" 
                        : "border-l-4 border-red-500",
                    statusClass: "bg-red-500 text-white",
                    icon: X,
                    pulse: false
                };
            default:
                return {
                    cardClass: "border-l-4 border-gray-500",
                    statusClass: "bg-gray-500 text-white",
                    icon: AlertCircle,
                    pulse: false
                };
        }
    };

    const handleAccept = () => {
        // Check which items need weight (meat items skip, except chicken nadan/thigh; fish items always need weight)
        const needsWeightItems = order.items.filter(item => itemNeedsWeight(butcherId, item.name));
        const noWeightItems = order.items.filter(item => !itemNeedsWeight(butcherId, item.name));
        
        if (needsWeightItems.length > 0 && noWeightItems.length > 0) {
            // Mixed: items that need weight AND items that don't need weight
            // Start with items that don't need weight first
            const firstNoWeightIndex = order.items.findIndex(item => !itemNeedsWeight(butcherId, item.name));
            setCurrentDialogOrder(order);
            updateDialogState({
                itemAcceptDialog: { isOpen: true, currentIndex: firstNoWeightIndex },
                weights: {},
                rejectedItems: {},
                unit: 'kg',
                currentIndex: 0, // This will be used for weight dialog later
                isOpen: false // Weight dialog closed initially
            });
        } else if (needsWeightItems.length > 0) {
            // Only items that need weight - open weight dialog
            const firstNeedsWeightIndex = order.items.findIndex(item => itemNeedsWeight(butcherId, item.name));
            setCurrentDialogOrder(order);
            updateDialogState({
                isOpen: true,
                weights: {},
                rejectedItems: {},
                unit: 'kg',
                currentIndex: firstNeedsWeightIndex >= 0 ? firstNeedsWeightIndex : 0,
                itemAcceptDialog: { isOpen: false, currentIndex: 0 }
            });
        } else {
            // Only items that don't need weight - open item accept dialog
            setCurrentDialogOrder(order);
            updateDialogState({
                itemAcceptDialog: { isOpen: true, currentIndex: 0 },
                weights: {},
                rejectedItems: {},
                unit: 'kg',
                currentIndex: 0,
                isOpen: false
            });
        }
    };

    const handleItemAccept = () => {
        // Accept current item (no weight needed), move to next item that doesn't need weight
        let nextIndex = dialogState.itemAcceptDialog?.currentIndex + 1 || 0;
        
        // Find next item that doesn't need weight
        while (nextIndex < order.items.length && itemNeedsWeight(butcherId, order.items[nextIndex].name)) {
            nextIndex++;
        }
        
        if (nextIndex < order.items.length) {
            // Move to next item that doesn't need weight
            updateDialogState({
                itemAcceptDialog: {
                    isOpen: true,
                    currentIndex: nextIndex
                }
            });
        } else {
            // All items that don't need weight are processed
            // Check if there are items that need weight
            const needsWeightItems = order.items.filter(item => itemNeedsWeight(butcherId, item.name));
            
            if (needsWeightItems.length > 0) {
                // Transition to weight dialog
                const firstNeedsWeightIndex = order.items.findIndex(item => itemNeedsWeight(butcherId, item.name));
                updateDialogState({
                    itemAcceptDialog: { isOpen: false, currentIndex: 0 },
                    isOpen: true,
                    currentIndex: firstNeedsWeightIndex >= 0 ? firstNeedsWeightIndex : 0
                });
            } else {
                // All items processed, submit the response
                handleSubmitResponse();
                updateDialogState({ 
                    itemAcceptDialog: { isOpen: false, currentIndex: 0 },
                    isOpen: false 
                });
            }
        }
    };
    
    const handleItemReject = () => {
        // Read from itemRejectDialogState (same source the dialog reads from)
        if (!itemRejectDialogState.reason.trim()) {
            toast({
                variant: "destructive",
                title: "Reason Required",
                description: "Please provide a reason for rejecting this item."
            });
            return;
        }
        
        // ✅ FIX: Store rejection using functional update and ref immediately
        setGlobalDialogState((prev: any) => {
            const currentState = prev[order.id] || dialogState;
            const updatedState = {
                ...currentState,
                rejectedItems: {
                    ...currentState.rejectedItems,
                    [itemRejectDialogState.itemId]: itemRejectDialogState.reason
                }
            };
            // ✅ FIX: Store in ref immediately for synchronous access
            dialogStateRef.current[order.id] = updatedState;
            return {
                ...prev,
                [order.id]: updatedState
            };
        });
        
        // Close dialog using the correct updater (same one the dialog component uses)
        updateItemRejectDialogState({
            isOpen: false,
            reason: '',
            itemId: ''
        });
        
        // Determine which dialog we're in and find next item accordingly
        const isInItemAcceptDialog = dialogState.itemAcceptDialog?.isOpen || false;
        let nextIndex: number;
        
        if (isInItemAcceptDialog) {
            // In item accept dialog - find next item that doesn't need weight
            nextIndex = (dialogState.itemAcceptDialog?.currentIndex || 0) + 1;
            while (nextIndex < order.items.length && itemNeedsWeight(butcherId, order.items[nextIndex].name)) {
                nextIndex++;
            }
            
            if (nextIndex < order.items.length) {
                updateDialogState({
                    itemAcceptDialog: {
                        isOpen: true,
                        currentIndex: nextIndex
                    }
                });
            } else {
                // All items that don't need weight processed, check for weight items
                const needsWeightItems = order.items.filter(item => itemNeedsWeight(butcherId, item.name));
                if (needsWeightItems.length > 0) {
                    const firstNeedsWeightIndex = order.items.findIndex(item => itemNeedsWeight(butcherId, item.name));
                    updateDialogState({
                        itemAcceptDialog: { isOpen: false, currentIndex: 0 },
                        isOpen: true,
                        currentIndex: firstNeedsWeightIndex >= 0 ? firstNeedsWeightIndex : 0
                    });
                } else {
                    handleSubmitResponse();
                    updateDialogState({ 
                        itemAcceptDialog: { isOpen: false, currentIndex: 0 },
                        isOpen: false 
                    });
                }
            }
        } else {
            // In weight dialog - find next item that needs weight
            nextIndex = dialogState.currentIndex + 1;
            while (nextIndex < order.items.length && !itemNeedsWeight(butcherId, order.items[nextIndex].name)) {
                nextIndex++;
            }
            
            if (nextIndex < order.items.length) {
                updateDialogState({
                    currentIndex: nextIndex
                });
            } else {
                handleSubmitResponse();
                updateDialogState({ isOpen: false });
            }
        }
    };

    const handlePickedWeightSubmit = () => {
        const currentItem = order.items[dialogState.currentIndex];
        if (!currentItem) {
            return;
        }

        // Check if item needs weight (always required when dialog is shown)
        const needsWeight = itemNeedsWeight(butcherId, currentItem.name);
        
        if (needsWeight) {
        const weight = dialogState.weights[currentItem.name];
            const unit = dialogState.unit || (currentItem.unit === 'nos' ? 'nos' : 'kg');
            
            if (!weight || weight.trim() === '') {
                toast({
                    variant: "destructive",
                    title: "Required",
                    description: unit === 'nos' ? "Please enter quantity." : "Please enter weight."
                });
                return;
            }
            
            // Validate based on unit
            if (unit === 'nos') {
                const num = parseInt(weight);
                if (isNaN(num) || num < 1 || num % 1 !== 0) {
                    toast({
                        variant: "destructive",
                        title: "Invalid Quantity",
                        description: "Please enter a valid weight"
                    });
                    return;
                }
            } else {
                const num = parseFloat(weight);
                if (isNaN(num) || num <= 0) {
            toast({
                variant: "destructive",
                title: "Invalid Weight",
                description: "Please enter a valid weight."
            });
            return;
        }
            }
        }

        // Find next item that needs weight, or move to next item
        let nextIndex = dialogState.currentIndex + 1;
        
        // Skip to next item that needs weight (works for all butcher types)
        while (nextIndex < order.items.length && !itemNeedsWeight(butcherId, order.items[nextIndex].name)) {
            nextIndex++;
        }
        
        if (nextIndex < order.items.length) {
            // Move to next item (or next item that needs weight)
            updateDialogState({
                currentIndex: nextIndex
            });
        } else {
            // All items processed, submit the response
            handleSubmitResponse();
            updateDialogState({ isOpen: false });
        }
    };

    const handleSubmitResponse = async () => {
        // Race condition protection: prevent duplicate operations
        if (pendingOperations.has(order.id)) {
            return;
        }

        // Mark as pending
        setPendingOperations(prev => new Set(prev).add(order.id));
        setIsLoading(true);

        // ✅ FIX: Read from ref first (latest state), then fallback to global state
        // This ensures we get the most recent rejections even if state update hasn't propagated
        const currentDialogState = dialogStateRef.current[order.id] || globalDialogState[order.id] || dialogState;

        // ✅ FIX: Check if all items are rejected and include preparing weights
        const updatedItems = order.items.map(item => {
            const rejected = currentDialogState.rejectedItems[item.id];
            if (rejected) {
                return { ...item, rejected };  // Include rejection in optimistic update
            }
            // ✅ FIX: Include preparing weight on item for immediate display
            const weight = currentDialogState.weights[item.name];
            const unit = currentDialogState.unit || (item.unit === 'nos' ? 'nos' : 'kg');
            const needsWeight = itemNeedsWeight(butcherId, item.name);
            
            if (needsWeight && weight) {
                return {
                    ...item,
                    preparingWeight: `${weight}${unit}` as any  // Include preparing weight
                };
            } else if (!needsWeight) {
                // Item doesn't need weight - use original quantity as preparing weight
                return {
                    ...item,
                    preparingWeight: `${item.quantity}${item.unit}` as any
                };
            }
            return item;
        });
        
        // ✅ FIX: Build itemWeights/itemQuantities for order-level display
        const itemWeights: {[itemName: string]: string} = {};
        const itemQuantities: {[itemName: string]: string} = {};
        
        order.items.forEach(item => {
            const rejected = currentDialogState.rejectedItems[item.id];
            if (!rejected) {
                const weight = currentDialogState.weights[item.name];
                const unit = currentDialogState.unit || (item.unit === 'nos' ? 'nos' : 'kg');
                const needsWeight = itemNeedsWeight(butcherId, item.name);
                
                if (needsWeight && weight) {
                    const weightStr = `${weight}${unit}`;
                    if (isMeatButcher(butcherId)) {
                        itemQuantities[item.name] = weightStr;
                    } else {
                        itemWeights[item.name] = weightStr;
                    }
                } else if (!needsWeight) {
                    const weightStr = `${item.quantity}${item.unit}`;
                    if (isMeatButcher(butcherId)) {
                        itemQuantities[item.name] = weightStr;
                    } else {
                        itemWeights[item.name] = weightStr;
                    }
                }
            }
        });
        
        const allItemsRejected = updatedItems.every(item => (item as any).rejected);
        const rejectionReason = allItemsRejected && updatedItems.length > 0 
            ? (updatedItems[0] as any).rejected 
            : undefined;

        // ✅ FIX: Determine order status based on whether all items are rejected
        const orderStatus: 'preparing' | 'rejected' = allItemsRejected ? 'rejected' : 'preparing';
        
        // ✅ FIX: Optimistic update with correct status AND preparing weights
        const optimisticOrder: Order = {
            ...order,
            status: orderStatus,
            ...(allItemsRejected && rejectionReason ? { rejectionReason } : {}),
            ...(orderStatus === 'preparing' ? { preparationStartTime: new Date() } : {}),
            items: updatedItems,
            // ✅ FIX: Include itemWeights/itemQuantities for immediate display
            ...(isMeatButcher(butcherId) 
                ? { itemQuantities: { ...order.itemQuantities, ...itemQuantities } }
                : { itemWeights: { ...order.itemWeights, ...itemWeights } })
        };
        
        // ✅ FIX: Set optimistic transition FIRST and force immediate re-render
        // Use flushSync to ensure state update happens synchronously and triggers immediate re-render
        flushSync(() => {
            setOptimisticTransitions((prev: any) => ({
                ...prev,
                [order.id]: {
                    originalStatus: order.status,
                    targetStatus: orderStatus,  // Use determined status (rejected or preparing)
                    order: optimisticOrder
                }
            }));
        });
        
        // ✅ FIX: Remove loading immediately - UI updates instantly via optimistic transition
        setIsLoading(false);
        
        // ✅ FIX: Don't call onUpdate - it overwrites optimistic transitions
        // Optimistic transitions handle UI updates, SSE will confirm later
        // onUpdate(optimisticOrder) - REMOVED to prevent overwriting optimistic state
        
        try {
            // Extract order number from order ID (ORD-123 -> 123 or ORD-2025-01-15-123 -> 123)
            const orderIdParts = order.id.replace('ORD-', '').split('-');
            const orderNo = parseInt(orderIdParts[orderIdParts.length - 1], 10);
            
            if (isNaN(orderNo)) {
                throw new Error('Invalid order number');
            }
            
            // ✅ FIX: Prepare response items using current state (not stale closure)
            const responseItems = order.items.map(item => {
                const rejected = currentDialogState.rejectedItems[item.id];
                if (rejected) {
                    return {
                        itemId: item.id,
                        rejected: rejected
                    };
                } else {
                    // Item accepted - get preparing weight
                    // ✅ FIX: Read from current state
                    const weight = currentDialogState.weights[item.name];
                    const unit = currentDialogState.unit || (item.unit === 'nos' ? 'nos' : 'kg');
                    const needsWeight = itemNeedsWeight(butcherId, item.name);
                    
                    if (needsWeight && weight) {
                        // Item needs weight and weight was entered
                        return {
                            itemId: item.id,
                            preparingWeight: `${weight}${unit}`
                        };
                    } else {
                        // Item accepted but doesn't need weight - use original order quantity
                        return {
                            itemId: item.id,
                            preparingWeight: `${item.quantity}${item.unit}`
                        };
                    }
                }
            });
            
            // ✅ FIX: Validation - ensure we have response for all items
            if (responseItems.length !== order.items.length) {
                throw new Error('Failed to process all items. Please try again.');
            }
            
            // Get JWT token
            const token = localStorage.getItem('jwt_token');
            if (!token) {
                throw new Error('Not authenticated');
            }
            
            // Send response to Central API
            const response = await fetch('/api/orders/respond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    orderNo,
                    items: responseItems
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || 'Failed to submit order response');
            }
            
            const result = await response.json();
            
            // ✅ FIX: Don't call onUpdate - SSE will update automatically
            // The server response will come via SSE and update the cache
            // We just need to remove from optimistic transitions
            
            // Remove from optimistic transitions (skeleton will be replaced by real order from SSE)
            setOptimisticTransitions((prev: any) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
            });
            
            toast({
                title: "Order accepted successfully",
                variant: "default"
            });
            
            // ✅ FIX: Don't call refetch() - SSE will update automatically
            // The optimistic update already shows the change instantly
            
            // Clear all dialog state after successful submission
            setGlobalDialogState((prev: any) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
            });
            setCurrentDialogOrder(null);
            
        } catch (error: any) {
            
            // Revert optimistic update on error - remove from transitions and restore original status
            setOptimisticTransitions((prev: any) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
            });
            
            const revertedOrder: Order = {
                ...order,
                status: 'new',
                preparationStartTime: undefined
            };
            
            try {
                await onUpdate(revertedOrder);
            } catch (revertError) {
                // ✅ FIX: Don't call refetch() - SSE will update automatically
            }
            
            toast({
                variant: "destructive",
                title: "Order can't be accepted"
            });
        } finally {
            // Remove from pending operations
            setPendingOperations(prev => {
                const next = new Set(prev);
                next.delete(order.id);
                return next;
            });
            setIsLoading(false);
        }
    };

    const handleReject = () => {
        updateRejectDialogState({
            isOpen: true,
            reason: ''
        });
    };

    const handleRejectConfirm = async () => {
        // Race condition protection
        if (pendingOperations.has(order.id)) {
            return;
        }

        const rejectionReason = rejectDialogState.reason;
        if (!rejectionReason.trim()) {
            toast({ 
                variant: "destructive", 
                title: "Reason Required", 
                description: "Please provide a reason for declining this order." 
            });
            return;
        }

        // Mark as pending
        setPendingOperations(prev => new Set(prev).add(order.id));
        setIsLoading(true);

        // ✅ FIX: Optimistic update with rejected status
        const optimisticOrder: Order = {
                ...order,
            status: 'rejected',
            rejectionReason: rejectionReason.trim(),
            items: order.items.map(item => ({
                ...item,
                rejected: rejectionReason.trim()  // Mark all items as rejected
            }))
        };

        // ✅ FIX: Set optimistic transition FIRST and force immediate re-render
        flushSync(() => {
            setOptimisticTransitions((prev: any) => ({
                ...prev,
                [order.id]: {
                    originalStatus: order.status,
                    targetStatus: 'rejected',
                    order: optimisticOrder
                }
            }));
        });

        // ✅ FIX: Close dialog immediately
        updateRejectDialogState({
            isOpen: false,
            reason: ''
        });

        // ✅ FIX: Remove loading immediately - UI updates instantly via optimistic transition
        setIsLoading(false);

        // ✅ FIX: Update local state optimistically (fire-and-forget, don't await)
        onUpdate(optimisticOrder).catch(err => {
            // Ignore errors from optimistic update - refetch will handle it
        });

        try {
            // Extract order number for rejection
            const orderIdParts = order.id.replace('ORD-', '').split('-');
            const orderNo = parseInt(orderIdParts[orderIdParts.length - 1], 10);
            
            if (isNaN(orderNo)) {
                throw new Error('Invalid order number');
            }

            // Prepare rejection response for all items
            const responseItems = order.items.map(item => ({
                itemId: item.id,
                rejected: rejectionReason.trim()
            }));

            // Get JWT token
            const token = localStorage.getItem('jwt_token');
            if (!token) {
                throw new Error('Not authenticated');
            }

            // Send rejection to Central API
            const response = await fetch('/api/orders/respond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    orderNo,
                    items: responseItems
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || 'Failed to reject order');
            }

            const result = await response.json();
            
            // ✅ FIX: Don't call onUpdate - SSE will update automatically
            // The server response will come via SSE and update the cache
            // We just need to remove from optimistic transitions
            
            toast({
                title: "Order rejected successfully"
            });
            
            // ✅ FIX: Remove from optimistic transitions (skeleton will be replaced by real order)
            setOptimisticTransitions((prev: any) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
            });

            // Clear all dialog state after successful rejection
            setGlobalDialogState((prev: any) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
            });
            setCurrentDialogOrder(null);
        } catch (error: any) {
            
            // ✅ FIX: Revert optimistic update on error
            setOptimisticTransitions((prev: any) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
            });
            
            const revertedOrder: Order = {
                ...order,
                status: 'new',
                rejectionReason: undefined
            };
            
            try {
                await onUpdate(revertedOrder);
            } catch (revertError) {
                // ✅ FIX: Don't call refetch() - SSE will update automatically
            }
            
            toast({
                variant: "destructive",
                title: "Order can't be rejected"
            });
        } finally {
            // Remove from pending operations
            setPendingOperations(prev => {
                const next = new Set(prev);
                next.delete(order.id);
                return next;
            });
            // ✅ FIX: isLoading already set to false after optimistic update
            // Only set to false here if we haven't already (error case)
            if (isLoading) {
                setIsLoading(false);
            }
        }
    };

    // Handle marking order as completed (prepared)
    const handlePrepared = async (preparingWeightsData: {[itemName: string]: string}) => {
        // Race condition protection
        if (pendingOperations.has(order.id)) {
            return;
        }

        // Mark as pending
        setPendingOperations(prev => new Set(prev).add(order.id));
        setIsLoading(true);

        // ✅ FIX: Optimistic update with preparing weights and revenue placeholder
        // Revenue will be calculated by server, but we include weights immediately
        const optimisticOrder: Order = {
            ...order,
            status: 'completed',
            completionTime: Date.now(),
            // ✅ FIX: Include preparing weights immediately for display
            ...(isMeatButcher(butcherId) 
                ? { itemQuantities: { ...order.itemQuantities, ...preparingWeightsData } }
                : { itemWeights: { ...order.itemWeights, ...preparingWeightsData } })
            // Note: Revenue will be calculated by server and come via SSE
        };
        
        // ✅ FIX: Mark order as in optimistic transition and force immediate re-render
        flushSync(() => {
            setOptimisticTransitions((prev: any) => ({
                ...prev,
                [order.id]: {
                    originalStatus: order.status,
                    targetStatus: 'completed',
                    order: optimisticOrder
                }
            }));
        });
        
        // ✅ FIX: Remove loading immediately - UI updates instantly via optimistic transition
        setIsLoading(false);
        
        // ✅ FIX: Don't call onUpdate - it overwrites optimistic transitions
        // Optimistic transitions handle UI updates, SSE will confirm later
        // onUpdate(optimisticOrder) - REMOVED to prevent overwriting optimistic state

        try {
            // Preserve existing itemWeights/itemQuantities based on butcher type
            const orderWithWeights = {
                ...order,
                ...(isMeatButcher(butcherId) 
                    ? { itemQuantities: preparingWeightsData }
                    : { itemWeights: preparingWeightsData })
            };

            const response = await fetch('/api/complete-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    order: orderWithWeights,
                    butcherId: butcherId
                })
            });

            if (!response.ok) {
                let errorData: any = {};
                try {
                    const text = await response.text();
                    if (text) {
                        errorData = JSON.parse(text);
                    }
                } catch (parseError) {
                }
                
                const errorMessage = errorData.message || errorData.details || errorData.error || `Failed to complete order: ${response.statusText || 'Unknown error'}`;
                throw new Error(errorMessage);
            }

            const result = await response.json();

            // ✅ FIX: Don't call onUpdate - SSE will update automatically
            // The server response will come via SSE and update the cache
            // We just need to remove from optimistic transitions
            
            // Remove from optimistic transitions (skeleton will be replaced by real order from SSE)
            setOptimisticTransitions((prev: any) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
            });

            // ✅ FIX: Don't call refetch() - SSE will update automatically
            // The optimistic update already shows the change instantly

            toast({
                title: "Order completed successfully",
                variant: "default"
            });

        } catch (error: any) {
            
            // Revert optimistic update on error
            setOptimisticTransitions((prev: any) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
            });
            
            const revertedOrder: Order = {
                ...order,
                status: 'preparing',
                completionTime: undefined
            };
            
            try {
                await onUpdate(revertedOrder);
            } catch (revertError) {
                // ✅ FIX: Don't call refetch() - SSE will update automatically
            }
            
            toast({
                title: "Order can't be completed",
                variant: "destructive"
            });
        } finally {
            // Remove from pending operations
            setPendingOperations(prev => {
                const next = new Set(prev);
                next.delete(order.id);
                return next;
            });
            setIsLoading(false);
        }
    };

    const getPrepTime = (startTime?: Date, endTime?: Date) => {
        if (startTime && endTime) {
            const diff = endTime.getTime() - startTime.getTime();
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
        return 'N/A';
    };

    // Helper function to get preparing weight for an item
    const getItemPreparingWeight = (item: OrderItem): string | null => {
        // First check if item has preparingWeight directly
        if ((item as any).preparingWeight) {
            return (item as any).preparingWeight;
        }
        
        // Then check order.itemWeights or itemQuantities
        if (isMeatButcher(butcherId)) {
            if (order.itemQuantities && order.itemQuantities[item.name]) {
                return `${order.itemQuantities[item.name]}${item.unit}`;
            }
        } else {
            if (order.itemWeights && order.itemWeights[item.name]) {
                return `${order.itemWeights[item.name]}kg`;
            }
        }
        
        return null;
    };

    // Helper function to get item revenue
    const getItemRevenue = (item: OrderItem): number | null => {
        if (!order.itemRevenues) {
            return null;
        }
        
        // ✅ FIX: Revenue is stored with key format: "itemName_size" (e.g., "black pomfret_small")
        const itemSize = item.size || 'default';
        const itemKey = `${item.name}_${itemSize}`;
        
        // Try the full key first (itemName_size)
        if (order.itemRevenues[itemKey] !== undefined) {
            return order.itemRevenues[itemKey];
        }
        
        // Fallback: Try just item name (for backward compatibility)
        if (order.itemRevenues[item.name] !== undefined) {
            return order.itemRevenues[item.name];
        }
        
        return null;
    };

    // Helper function to check if item is rejected
    const isItemRejected = (item: OrderItem): boolean => {
        return !!(item as any).rejected;
    };

    // Helper function to get item rejection reason
    const getItemRejectionReason = (item: OrderItem): string | null => {
        return (item as any).rejected || null;
    };

    const statusStyling = getStatusStyling();
    const StatusIcon = statusStyling.icon;

    return (
        <>
            <Card className={cn(
                "group transition-all duration-200",
                isOverdue ? "border-red-500/50 bg-red-50 dark:bg-red-950/20" : "bg-white dark:bg-gray-900",
                statusStyling.cardClass
            )}>
                <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                                {getDisplayOrderId(order.id)}
                            </CardTitle>
                            <CardDescription className="text-lg font-medium text-muted-foreground">
                                {order.customerName}
                            </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                        {order.status === 'preparing' && order.preparationStartTime && <CountdownTimer startTime={order.preparationStartTime} orderStatus={order.status} />}
                            
                            {/* Dynamic Status Badge */}
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-1 rounded-md font-medium text-base",
                                statusStyling.statusClass
                            )}>
                                <StatusIcon className="h-4 w-4" />
                                {order.status === 'prepared' && 'Prepared'}
                                {order.status === 'rejected' && (order.rejectionReason || 'Declined')}
                                {order.status === 'completed' && 'Completed'}
                                {order.status === 'new' && 'New Order'}
                                {order.status === 'preparing' && 'Preparing'}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 py-3">
                    <div className="space-y-2">
                        {order.items.map((item, index) => {
                            const itemRejected = isItemRejected(item);
                            const rejectionReason = getItemRejectionReason(item);
                            const preparingWeight = getItemPreparingWeight(item);
                            const itemRevenue = getItemRevenue(item);
                            
                            return (
                                <div 
                                    key={item.id} 
                                    className={cn(
                                        "group/item p-2.5 rounded-lg bg-gradient-to-r from-muted/30 to-muted/10 border transition-all duration-200",
                                        itemRejected 
                                            ? "border-red-300 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/20" 
                                            : "border-border/50 hover:border-primary/20"
                                    )}
                                >
                                <div className="flex justify-between items-start">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={cn(
                                                    "font-semibold text-base",
                                                    itemRejected 
                                                        ? "line-through text-gray-500 dark:text-gray-500" 
                                                        : "text-foreground"
                                                )}>
                                                {getItemDisplayName(item.name, butcherId)}
                                            </span>
                                                {/* Show preparing weight if available, otherwise show original quantity only for new orders */}
                                                {order.status === 'new' ? (
                                            <span className="text-muted-foreground text-sm font-medium">
                                                        {item.quantity}{item.unit}
                                            </span>
                                                ) : preparingWeight ? (
                                                    <span className="text-primary text-sm font-medium">
                                                        {preparingWeight}
                                                </span>
                                                ) : null}
                                                {itemRejected && rejectionReason && (
                                                    <Badge variant="destructive" className="text-sm px-2 py-0.5">
                                                        {rejectionReason.length > 20 ? rejectionReason.substring(0, 20) + '...' : rejectionReason}
                                                    </Badge>
                                                )}
                                                {!itemRejected && (order.status === 'preparing' || order.status === 'completed') && (
                                                    <Badge variant="outline" className="text-sm px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                                                        Accepted
                                                    </Badge>
                                                )}
                                            {item.size && (
                                                    <Badge variant="outline" className="text-sm px-2.5 py-1 border-2 border-blue-300 dark:border-blue-500 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800">
                                                    Size: {item.size}
                                                    </Badge>
                                            )}
                                            {item.cutType && (
                                                    <Badge variant="outline" className="text-sm font-semibold px-3 py-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-2 border-blue-400 dark:border-blue-600 shadow-sm">
                                                    Preference: {item.cutType}
                                                    </Badge>
                                            )}
                                    </div>
                                            
                                            {/* Show item revenue in completed/preparing tabs - compact inline display */}
                                            {isArchived && itemRevenue !== null && !itemRejected && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <IndianRupee className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{itemRevenue.toFixed(2)}</span>
                                </div>
                                            )}
                                </div>
                            </div>
                                </div>
                            );
                        })}
                    </div>
                    

                    {isArchived && (order.status === 'prepared' || order.status === 'completed' || order.status === 'rejected') && (
                        <div className="mt-3 pt-3 border-t border-border/30">
                            <div className="flex items-center justify-between gap-4 flex-wrap text-sm">
                                {order.pickedWeight && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Weight className="h-3 w-3" />
                                        <span>{getDisplayWeight(order, butcherId).toFixed(2)}kg</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{getPrepTime(order.preparationStartTime, order.preparationEndTime)}</span>
                                    </div>
                                {(() => {
                                    // ✅ FIX: Calculate revenue from itemRevenues if order.revenue is missing/zero
                                    // This handles cases where revenue wasn't properly calculated or stored
                                    let displayRevenue = order.revenue;
                                    
                                    if ((displayRevenue === undefined || displayRevenue === null || displayRevenue === 0) && order.itemRevenues) {
                                        // Sum all item revenues (rejected items already have 0 revenue)
                                        displayRevenue = Object.values(order.itemRevenues).reduce((sum, rev) => sum + rev, 0);
                                    }
                                    
                                    // Only show revenue if it's greater than 0 (don't show ₹0.00)
                                    if (displayRevenue !== undefined && displayRevenue !== null && displayRevenue > 0) {
                                        return (
                                            <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                                                <IndianRupee className="h-3 w-3" />
                                                <span>{displayRevenue.toFixed(2)}</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                    )}
                    {order.address && (
                        <div className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border/30 flex items-start gap-1.5">
                           <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> 
                           <span>{order.address}</span>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end gap-3 pt-4">
                    {order.status === 'new' && (
                        <>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleReject}
                                disabled={isPending || isLoading}
                                className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:border-red-800 dark:hover:text-red-400 transition-all duration-200 shadow-modern hover:shadow-modern-lg disabled:opacity-50"
                            >
                                {/* ✅ FIX: Remove loading text - button disabled but no spinner */}
                                        <ThumbsDown className="mr-2 h-4 w-4" /> 
                                        Reject
                            </Button>
                            <Button 
                                size="sm" 
                                onClick={handleAccept}
                                disabled={isPending || isLoading}
                                className="bg-gradient-primary hover:shadow-modern-lg transition-all duration-200 text-primary-foreground font-semibold disabled:opacity-50"
                            >
                                {/* ✅ FIX: Remove loading text - button disabled but no spinner */}
                                <ThumbsUp className="mr-2 h-4 w-4" /> 
                                Accept Order
                            </Button>
                        </>
                    )}
                    {order.status === 'preparing' && (
                        <Button 
                            size="sm" 
                            onClick={() => {
                            if (isMeatButcher(butcherId)) {
                                // Meat butchers: Use itemQuantities for revenue calculation
                                const weightsToUse: {[key: string]: string} = {};
                                
                                order.items.forEach(item => {
                                    if (order.itemQuantities && order.itemQuantities[item.name]) {
                                        weightsToUse[item.name] = order.itemQuantities[item.name];
                                    } else {
                                        weightsToUse[item.name] = item.quantity.toString();
                                    }
                                });
                                
                                handlePrepared(weightsToUse);
                            } else {
                                // Fish butchers: Use itemWeights for revenue calculation
                                const weightsToUse: {[key: string]: string} = {};
                                
                                order.items.forEach(item => {
                                    if (order.itemWeights && order.itemWeights[item.name]) {
                                        weightsToUse[item.name] = order.itemWeights[item.name];
                                    } else {
                                        weightsToUse[item.name] = item.quantity.toString();
                                    }
                                });
                                
                                handlePrepared(weightsToUse);
                            }
                            }} 
                            disabled={isLoading || isPending}
                            className="bg-gradient-success hover:shadow-modern-lg transition-all duration-200 text-white font-semibold disabled:opacity-50"
                        >
                           {/* ✅ FIX: Remove loading text - button disabled but no spinner */}
                                   <CheckCircle className="mr-2 h-4 w-4" />
                                   Mark as Prepared
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {/* Dialogs - Only render for new orders */}
            {order.status === 'new' && (
                <>
                    <ItemAcceptDialog
                        order={order}
                        dialogState={itemAcceptDialogState}
                        updateDialogState={(updates: any) => {
                            // Update both itemAcceptDialog and potentially itemRejectDialog
                            const newState: any = { 
                                itemAcceptDialog: { ...itemAcceptDialogState, ...updates }
                            };
                            if (updates.itemRejectDialog) {
                                newState.itemRejectDialog = updates.itemRejectDialog;
                            }
                            updateDialogState(newState);
                        }}
                        handleItemAccept={handleItemAccept}
                        handleItemCancel={() => updateDialogState({ itemAcceptDialog: { isOpen: false, currentIndex: 0 } })}
                        butcherId={butcherId}
                    />
                    
            <WeightDialog
                order={order}
                dialogState={dialogState}
                updateDialogState={updateDialogState}
                handleWeightSubmit={handlePickedWeightSubmit}
                handleWeightCancel={() => updateDialogState({ isOpen: false })}
                        butcherId={butcherId}
            />
            
            <RejectDialog
                order={order}
                rejectDialogState={rejectDialogState}
                updateRejectDialogState={updateRejectDialogState}
                handleReject={handleReject}
                handleRejectConfirm={handleRejectConfirm}
            />
                    
                    {/* Item Rejection Dialog */}
                    <Dialog open={itemRejectDialogState.isOpen} onOpenChange={(open) => updateItemRejectDialogState({ isOpen: open })}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Reject Item</DialogTitle>
                                <DialogDescription>
                                    Please provide a reason for rejecting this item.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="item-reject-reason">Reason for rejection</Label>
                                    <Textarea
                                        id="item-reject-reason"
                                        placeholder="Enter reason for rejecting this item..."
                                        value={itemRejectDialogState.reason}
                                        onChange={(e) => updateItemRejectDialogState({ reason: e.target.value })}
                                        className="mt-2"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => updateItemRejectDialogState({ isOpen: false, reason: '', itemId: '' })}>
                                    Cancel
                                </Button>
                                <Button 
                                    variant="destructive" 
                                    onClick={handleItemReject}
                                    disabled={!itemRejectDialogState.reason.trim()}
                                >
                                    Reject Item
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </>
    );
};

// Main Dashboard Component
export default function OrderManagementPage() {
  const { butcher } = useAuth();
  const { toast } = useToast();

  // Global dialog state to prevent reset during cache updates
  const [globalDialogState, setGlobalDialogState] = useState<{
    [orderId: string]: {
      isOpen: boolean;
      weights: {[itemName: string]: string};
      rejectedItems: {[itemName: string]: string}; // itemId -> rejection reason
      unit: 'kg' | 'nos'; // Only kg and nos, no grams
      currentIndex: number;
      itemAcceptDialog?: {
        isOpen: boolean;
        currentIndex: number;
      };
      itemRejectDialog?: {
        isOpen: boolean;
        reason: string;
        itemId: string;
      };
      rejectDialog?: {
        isOpen: boolean;
        reason: string;
      };
    }
  }>({});

  // Track orders in optimistic transition (showing skeleton)
  const [optimisticTransitions, setOptimisticTransitions] = useState<{
    [orderId: string]: {
      originalStatus: string;
      targetStatus: string;
      order: Order;
    }
  }>({});

  // Current dialog order data
  const [currentDialogOrder, setCurrentDialogOrder] = useState<Order | null>(null);

  // Use cache hook - orders pushed from Central API via SSE
  // SSE provides real-time updates, so no refreshInterval needed
  const { orders: allOrders, isLoading, error, refetch } = useOrderCache({
    butcherId: butcher?.id || '',
    enabled: !!butcher
  });

  // Show error if there's an issue fetching orders
  useEffect(() => {
    if (error) {
      toast({ 
        variant: "destructive", 
        title: "Failed to fetch orders", 
        description: "Could not fetch orders." 
      });
    }
  }, [error, toast]);
  
  // Filter orders to show only today's orders
  const today = new Date();
  const todayString = today.toDateString();
  
  // ✅ FIX: Get order IDs that are in optimistic transitions (to exclude from original tabs)
  // This must be calculated BEFORE filtering todayOrders to ensure instant tab transitions
  const optimisticOrderIds = new Set(Object.keys(optimisticTransitions));
  
  const todayOrders = allOrders.filter(order => {
    const orderDate = new Date(order.orderTime);
    const isToday = orderDate.toDateString() === todayString;
    return isToday;
  });
  
  // ✅ FIX: Include optimistic transitions in order lists AND exclude from original tabs
  // This ensures orders move instantly between tabs without waiting for SSE
  const newOrders = todayOrders.filter(o => 
    o.status === 'new' && !optimisticOrderIds.has(o.id)  // Exclude orders in optimistic transitions
  );
  const preparingOrders = [
    ...todayOrders.filter(o => 
      o.status === 'preparing' && !optimisticOrderIds.has(o.id)  // Exclude orders in optimistic transitions
    ),
    ...Object.values(optimisticTransitions)
      .filter(t => t.targetStatus === 'preparing')
      .map(t => t.order)
  ];
  const completedOrders = [
    ...todayOrders.filter(o => 
      (o.status === 'completed' || o.status === 'rejected') && !optimisticOrderIds.has(o.id)  // Exclude orders in optimistic transitions
    ),
    ...Object.values(optimisticTransitions)
      .filter(t => t.targetStatus === 'completed' || t.targetStatus === 'rejected')  // ✅ FIX: Include rejected orders
      .map(t => t.order)
  ];
  

  const handleOrderUpdate = async (updatedOrder: Order) => {
    if (!butcher) return;
    // This is called from OrderCard, but we handle optimistic transitions via useEffect below
  };

  // ✅ FIX: Remove optimistic transitions when SSE confirms the update
  useEffect(() => {
    setOptimisticTransitions((prev: any) => {
      const next = { ...prev };
      let changed = false;
      
      // Check each optimistic transition
      Object.keys(prev).forEach(orderId => {
        const transition = prev[orderId];
        // Check if order exists in allOrders with matching status
        const realOrder = allOrders.find(o => o.id === orderId);
        if (realOrder && realOrder.status === transition.targetStatus) {
          // SSE confirmed - remove optimistic transition
          delete next[orderId];
          changed = true;
        }
      });
      
      return changed ? next : prev;
      });
  }, [allOrders]);

  if (!butcher) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Please select a butcher</h1>
          <p className="text-muted-foreground mt-2">Choose a butcher to view orders</p>
        </div>
      </div>
    );
  }

  // ✅ FIX: Remove global loading screen - show orders immediately
  // Only show loading on initial load (when orders array is empty and isLoading is true)
  // After initial load, SSE handles updates without blocking UI
  if (isLoading && allOrders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Loading orders...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {/* ✅ FIX: Responsive header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Order Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Managing orders for {butcher.name}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-xs sm:text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* ✅ FIX: Responsive Kanban-style Tabs with padding */}
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-1 sm:gap-2 p-1 px-2 sm:px-1">
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            New Orders
      {newOrders.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {newOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preparing" className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Preparing
            {preparingOrders.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {preparingOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed
            {completedOrders.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {completedOrders.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* New Orders Tab */}
        <TabsContent value="new" className="mt-4 sm:mt-6">
          {newOrders.length > 0 ? (
          <div className="grid gap-4">
            {newOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdate={handleOrderUpdate}
                butcherId={butcher.id}
                refetch={refetch}
                allOrders={allOrders}
                globalDialogState={globalDialogState}
                setGlobalDialogState={setGlobalDialogState}
                setCurrentDialogOrder={setCurrentDialogOrder}
                setOptimisticTransitions={setOptimisticTransitions}
              />
            ))}
          </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No new orders</h3>
              <p className="text-muted-foreground">New orders will appear here</p>
        </div>
      )}
        </TabsContent>

        {/* Preparing Orders Tab */}
        <TabsContent value="preparing" className="mt-4 sm:mt-6">
          {preparingOrders.length > 0 ? (
          <div className="grid gap-4">
            {preparingOrders.map((order) => {
              // ✅ FIX: Show actual order immediately with optimistic data
              // Use optimistic order if available, otherwise use real order
              const displayOrder = optimisticTransitions[order.id]?.targetStatus === 'preparing'
                ? optimisticTransitions[order.id].order
                : order;
              
              return (
              <OrderCard
                key={order.id}
                  order={displayOrder}
                onUpdate={handleOrderUpdate}
                butcherId={butcher.id}
                refetch={refetch}
                allOrders={allOrders}
                globalDialogState={globalDialogState}
                setGlobalDialogState={setGlobalDialogState}
                setCurrentDialogOrder={setCurrentDialogOrder}
                  setOptimisticTransitions={setOptimisticTransitions}
              />
              );
            })}
          </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Timer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No orders in preparation</h3>
              <p className="text-muted-foreground">Orders being prepared will appear here</p>
        </div>
      )}
        </TabsContent>

        {/* Completed Orders Tab */}
        <TabsContent value="completed" className="mt-4 sm:mt-6">
          {completedOrders.length > 0 ? (
          <div className="grid gap-4">
              {completedOrders.map((order) => {
                // ✅ FIX: Show actual order immediately with optimistic data
                // Use optimistic order if available, otherwise use real order
                const optimisticTransition = optimisticTransitions[order.id];
                const displayOrder = optimisticTransition && (optimisticTransition.targetStatus === 'completed' || optimisticTransition.targetStatus === 'rejected')
                  ? optimisticTransition.order 
                  : order;
                
                return (
              <OrderCard
                key={order.id}
                    order={displayOrder}
                onUpdate={handleOrderUpdate}
                butcherId={butcher.id}
                isArchived={true}
                refetch={refetch}
                allOrders={allOrders}
                globalDialogState={globalDialogState}
                setGlobalDialogState={setGlobalDialogState}
                setCurrentDialogOrder={setCurrentDialogOrder}
                    setOptimisticTransitions={setOptimisticTransitions}
              />
                );
              })}
          </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No completed orders</h3>
              <p className="text-gray-500 dark:text-gray-400">Completed orders will appear here</p>
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
