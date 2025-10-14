
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { getFishItemFullName, isFishButcher, freshButchers } from '../../lib/freshMockData';
import { getCommissionRate } from '../../lib/rates';
import { getRatesFromSheet } from '../../lib/sheets';
// Removed direct import of salesSheets to avoid client-side Node.js modules

// Helper function to determine if a butcher is a meat butcher
function isMeatButcher(butcherId: string): boolean {
    return ['usaj', 'usaj_mutton', 'pkd'].includes(butcherId);
}

// Helper function to determine if a chicken item needs weight dialog
function needsWeightDialog(itemName: string): boolean {
    const itemNameLower = itemName.toLowerCase();
    return itemNameLower.includes('chicken nadan') || 
           itemNameLower.includes('chicken thigh') ||
           itemNameLower.includes('nadan') ||
           itemNameLower.includes('thigh');
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

// Separate component for the reject dialog that won't be affected by polling
const RejectDialog = ({ 
    order, 
    rejectDialogState, 
    updateRejectDialogState, 
    handleReject, 
    onClose,
    isLoading
}: {
    order: Order;
    rejectDialogState: any;
    updateRejectDialogState: (updates: any) => void;
    handleReject: () => void;
    onClose: () => void;
    isLoading: boolean;
}) => {
    if (!rejectDialogState.isOpen) {
        return null;
    }

    return createPortal(
        <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Decline Order {getDisplayOrderId(order.id)}?</DialogTitle>
                    <DialogDescription>Please provide a reason for declining this order. This cannot be undone.</DialogDescription>
                </DialogHeader>
                <Textarea 
                    value={rejectDialogState.reason} 
                    onChange={(e) => updateRejectDialogState({ reason: e.target.value })} 
                    placeholder="Enter reason for declining this order..."
                />
                <DialogFooter>
                    <Button 
                        variant="outline" 
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleReject} 
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Confirm Decline'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>,
        document.body
    );
};

// Separate component for the weight dialog that won't be affected by polling
const WeightDialog = ({ 
    order, 
    butcherId, 
    dialogState, 
    updateDialogState, 
    handlePickedWeightSubmit, 
    onClose 
}: {
    order: Order;
    butcherId: string;
    dialogState: any;
    updateDialogState: (updates: any) => void;
    handlePickedWeightSubmit: () => void;
    onClose: () => void;
}) => {
    if (!dialogState.isOpen) {
        return null;
    }

    return createPortal(
        <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Enter Preparation Weight for {getDisplayOrderId(order.id)}</DialogTitle>
                    <DialogDescription>
                        Item {dialogState.currentIndex + 1} of {order.items.length}: {getItemDisplayName(order.items[dialogState.currentIndex]?.name || '', butcherId)}
                        <br />
                        {isMeatButcher(butcherId) ? 
                            'Enter the actual preparation weight for this chicken item.' : 
                            'Enter the preparation weight for this specific item.'
                        }
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                        <div className="font-medium">{getItemDisplayName(order.items[dialogState.currentIndex]?.name || '', butcherId)}</div>
                        <div className="text-sm text-muted-foreground">
                            Quantity: {order.items[dialogState.currentIndex]?.quantity} {order.items[dialogState.currentIndex]?.unit}
                            {order.items[dialogState.currentIndex]?.size && (
                                <span className="ml-2">Size: {order.items[dialogState.currentIndex]?.size}</span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="picked-weight">Preparation Weight</Label>
                        <div className="flex gap-2">
                            <Input 
                                id="picked-weight" 
                                type="number" 
                                step="0.1"
                                min="0"
                                placeholder="Enter weight"
                                value={dialogState.weights[order.items[dialogState.currentIndex]?.name] || ''} 
                                onChange={(e) => updateDialogState({
                                    weights: {
                                        ...dialogState.weights,
                                        [order.items[dialogState.currentIndex]?.name]: e.target.value
                                    }
                                })} 
                                onKeyDown={(e) => {
                                    // Prevent Enter key from closing dialog
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handlePickedWeightSubmit();
                                    }
                                }}
                            />
                            <Select value={dialogState.unit} onValueChange={(value: 'kg' | 'g') => updateDialogState({ unit: value })}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="g">g</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {Object.keys(dialogState.weights).length > 0 && (
                        <div className="text-sm text-muted-foreground">
                            <strong>Weights entered:</strong>
                            {Object.entries(dialogState.weights).map(([itemName, weight]) => (
                                <div key={itemName} className="ml-2">• {itemName}: {weight} {dialogState.unit}</div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter className="gap-2">
                    <Button 
                        variant="outline" 
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handlePickedWeightSubmit}
                        disabled={!dialogState.weights[order.items[dialogState.currentIndex]?.name] || 
                                 parseFloat(dialogState.weights[order.items[dialogState.currentIndex]?.name] || '0') <= 0}
                    >
                        {dialogState.currentIndex < order.items.length - 1 ? 'Next Item' : 'Accept and Start Preparing'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>,
        document.body
    );
};

// Helper function to get display name for items
const getItemDisplayName = (itemName: string, butcherId: string): string => {
  if (isFishButcher(butcherId)) {
    // Check if the item name already has three languages (contains ' - ')
    if (itemName.includes(' - ') && itemName.split(' - ').length >= 3) {
      // Already has three-language format, return as is
      return itemName;
    } else {
      // Only has English name, try to get the full three-language name
      return getFishItemFullName(itemName);
    }
  }
  // For other butchers, return the name as is
  return itemName;
};

// Helper function to extract order number from full order ID for display
const getDisplayOrderId = (orderId: string): string => {
  // Extract order number from ID like "ORD-2024-01-15-123" -> "ORD-123"
  const orderIdParts = orderId.replace('ORD-', '').split('-');
  const orderNumber = orderIdParts[orderIdParts.length - 1]; // Get the last part (order number)
  return `ORD-${orderNumber}`;
};
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import type { Order } from '../../lib/types';
import { useOrderPolling, useOrderUpdate } from '../../hooks/useOrderPolling';
import { useButcherEarnings } from '../../hooks/useButcherEarnings';
import { ThumbsDown, ThumbsUp, Timer, CheckCircle, CookingPot, PackageCheck, AlertCircle, RefreshCw, MapPin, Loader2, Weight, Clock, IndianRupee } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
// Removed useOrderAlert import - using global alert system from layout instead
import { Skeleton, OrderCardSkeleton } from '../../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { cn } from '../../lib/utils';

const CountdownTimer = ({ startTime, orderStatus }: { startTime: Date; orderStatus: string }) => {
  const prepTime = 20 * 60 * 1000;
  const endTime = startTime.getTime() + prepTime;
  const [timeLeft, setTimeLeft] = useState(endTime - Date.now());
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Stop timer if order is completed, prepared, or rejected
    if (['completed', 'prepared', 'rejected'].includes(orderStatus)) {
      setIsCompleted(true);
      return;
    }

    const timer = setInterval(() => {
      const newTimeLeft = endTime - Date.now();
      if (newTimeLeft <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
      } else {
        setTimeLeft(newTimeLeft);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, orderStatus]);

  // Don't show timer if order is completed
  if (isCompleted) {
    return null;
  }

  const minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  const isOvertime = timeLeft <= 0;

  return (
    <div className={`flex items-center gap-2 font-medium ${isOvertime ? 'text-red-500' : 'text-amber-600'}`}>
      <Timer className="h-4 w-4" />
      <span>
        {isOvertime ? 'Overdue ' : ''}
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};


const OrderCard = ({ order, onUpdate, butcherId, isArchived, butcherMenu, refetch, allOrders, globalDialogState, setGlobalDialogState, setCurrentDialogOrder }: { order: Order; onUpdate: (updatedOrder: Order) => Promise<void>; butcherId: string; isArchived?: boolean; butcherMenu?: any; refetch: () => Promise<void>; allOrders: Order[]; globalDialogState: any; setGlobalDialogState: any; setCurrentDialogOrder: any }) => {
    // Check if order is overdue
    const isOverdue = order.status === 'preparing' && order.preparationStartTime && 
                      (Date.now() - order.preparationStartTime.getTime()) > (20 * 60 * 1000);
    
    // Get dialog state for this specific order from global state
    const dialogState = globalDialogState[order.id] || {
        isOpen: false,
        weights: {},
        unit: 'kg' as const,
        currentIndex: 0
    };
    
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    // Use ref to prevent dialog from closing due to re-renders
    const dialogOpenRef = useRef(false);

    const isFishStall = ['kak', 'ka_sons', 'alif'].includes(butcherId);
    
    
    // Helper function to update dialog state
    const updateDialogState = (updates: Partial<typeof dialogState>) => {
        setGlobalDialogState((prev: any) => ({
            ...prev,
            [order.id]: {
                ...dialogState,
                ...updates
            }
        }));
    };


    // Get status-specific styling
    const getStatusStyling = () => {
        switch (order.status) {
            case 'new':
                return {
                    cardClass: "border-l-4 border-blue-500",
                    statusClass: "bg-blue-500 text-white",
                    icon: PackageCheck,
                    pulse: false
                };
            case 'preparing':
                return {
                    cardClass: "border-l-4 border-yellow-500",
                    statusClass: "bg-yellow-500 text-white",
                    icon: CookingPot,
                    pulse: false
                };
            case 'completed':
                return {
                    cardClass: "border-l-4 border-green-500",
                    statusClass: "bg-green-500 text-white",
                    icon: CheckCircle,
                    pulse: false
                };
            case 'rejected':
                return {
                    cardClass: "border-l-4 border-red-500",
                    statusClass: "bg-red-500 text-white",
                    icon: ThumbsDown,
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

    // Disable earnings fetching to avoid quota issues since we removed revenue display from new/preparing orders
    const { earnings, isLoading: earningsLoading, error: earningsError } = useButcherEarnings({
        butcherId,
        orderItems: order.items,
        enabled: false // Disabled to prevent quota exceeded errors
    });
    


    const handleAccept = () => {
        if (isMeatButcher(butcherId)) {
            // Check if any chicken items need weight dialog
            const needsWeightItems = order.items.filter(item => needsWeightDialog(item.name));
            
            if (needsWeightItems.length > 0) {
                // Meat butchers with chicken items: Need to enter preparation weight
                
                dialogOpenRef.current = true;
                setCurrentDialogOrder(order);
                updateDialogState({
                    isOpen: true,
                    weights: {},
                    unit: 'kg',
                    currentIndex: 0
                });
            } else {
                // Meat butchers without chicken items: Directly accept and move to preparing status
                const updatedOrder: Order = { 
                ...order, 
                    status: 'preparing' as const, 
                preparationStartTime: new Date(),
                // For meat butchers, use quantities as weights
                itemQuantities: order.items.reduce((acc, item) => {
                    acc[item.name] = item.quantity.toString();
                    return acc;
                }, {} as {[key: string]: string})
            };
            
                console.log('\n=== MEAT BUTCHER ORDER ACCEPTANCE (NO CHICKEN ITEMS) ===');
            console.log('Order accepted directly:', {
                orderId: order.id,
                status: updatedOrder.status,
                itemQuantities: updatedOrder.itemQuantities,
                items: order.items.map(item => ({ name: item.name, quantity: item.quantity }))
            });
            console.log('=====================================\n');
            
            onUpdate(updatedOrder);
                // Check if there are still other new orders before stopping alert
                const remainingNewOrders = allOrders.filter(o => o.status === 'new' && o.id !== order.id);
                console.log('Meat butcher order accepted:', order.id, '- remaining new orders:', remainingNewOrders.length);
                if (remainingNewOrders.length === 0 && (window as any).globalStopAlert) {
                  console.log('No more new orders, stopping alert immediately');
                  (window as any).globalStopAlert();
                }
                // Immediately refetch orders to update UI
                refetch();
                toast({ 
                    title: "Order Accepted", 
                    description: `${getDisplayOrderId(order.id)} is now being prepared.`,
                    variant: "success"
                });
            }
        } else {
            // Fish butchers: Need to enter preparation weight
            dialogOpenRef.current = true;
            setCurrentDialogOrder(order);
            updateDialogState({
                isOpen: true,
                weights: {},
                unit: 'kg',
                currentIndex: 0
            });
        }
    };

    const handlePickedWeightSubmit = () => {
        const currentItem = order.items[dialogState.currentIndex];
        if (!currentItem) {
            console.error('No current item found at index:', dialogState.currentIndex);
            return;
        }
        
        const currentWeight = dialogState.weights[currentItem.name] || '';
        let weight = parseFloat(currentWeight);
        
        if (isNaN(weight) || weight <= 0) {
            toast({ 
                variant: "destructive", 
                title: "Validation Error", 
                description: `Please enter a valid picked weight for ${currentItem.name}.` 
            });
            return;
        }
        
        // Validate reasonable weight limits (prevent data entry errors)
        if (weight > 100) {
            toast({ 
                variant: "destructive", 
                title: "Weight Too High", 
                description: `Weight ${weight}kg seems too high. Please check if you meant ${(weight/1000).toFixed(3)}kg or ${weight/1000}kg?` 
            });
            return;
        }
        
        // Convert to kg if needed
        if (dialogState.unit === 'g') {
            weight = weight / 1000;
        }

        // Update the weights object
        const newWeights = { ...dialogState.weights, [currentItem.name]: weight.toString() };

        // Check if we have weights for all items
        if (dialogState.currentIndex < order.items.length - 1) {
            // Move to next item
            updateDialogState({
                weights: newWeights,
                currentIndex: dialogState.currentIndex + 1
            });
            toast({ 
                title: "Weight Saved", 
                description: `Weight for ${currentItem.name} saved. Moving to next item.`,
                variant: "default"
            });
        } else {
            // All weights collected, update the order
            const totalPickedWeight = Object.values(newWeights).reduce((sum: number, w) => sum + parseFloat(w as string), 0);
            
            
            const updatedOrder: Order = { 
                ...order, 
                status: 'preparing' as const, 
                preparationStartTime: new Date(), 
                pickedWeight: totalPickedWeight as number // Update pickedWeight to reflect custom entered weights
            };
            
            // Store weights differently based on butcher type
            if (isMeatButcher(butcherId)) {
                // Meat butchers: Store in itemQuantities
                updatedOrder.itemQuantities = newWeights;
            } else {
                // Fish butchers: Store in itemWeights
                updatedOrder.itemWeights = newWeights;
            }
            
            console.log('Final updatedOrder before onUpdate:', {
                id: updatedOrder.id,
                status: updatedOrder.status,
                pickedWeight: updatedOrder.pickedWeight,
                itemQuantities: updatedOrder.itemQuantities,
                itemWeights: updatedOrder.itemWeights,
                butcherId: butcherId
            });
            
            console.log('Updated order:', {
                id: updatedOrder.id,
                status: updatedOrder.status,
                itemQuantities: updatedOrder.itemQuantities,
                itemWeights: updatedOrder.itemWeights,
                pickedWeight: updatedOrder.pickedWeight
            });
            console.log('=====================================\n');
            
            // Close dialog first to prevent any race conditions
            dialogOpenRef.current = false;
            setCurrentDialogOrder(null);
            updateDialogState({
                isOpen: false,
                weights: {},
                unit: 'kg',
                currentIndex: 0
            });
            
            // Update order
            onUpdate(updatedOrder);
            
            // Show success message
            toast({ 
                title: "Order Accepted", 
                description: `${getDisplayOrderId(order.id)} is now being prepared with total weight ${(totalPickedWeight as number).toFixed(2)}kg.`,
                variant: "default"
            });
            
            // Refetch orders and check for remaining new orders
            setTimeout(async () => {
                await refetch();
                // Global alert system will handle stopping when newOrders.length becomes 0
            }, 100);
        }
    };

    const handleReject = () => {
        setGlobalDialogState((prev: any) => ({
            ...prev,
            [order.id]: {
                ...prev[order.id],
                rejectDialog: { isOpen: true, reason: '' }
            }
        }));
    };
    

    const handlePrepared = async (preparingWeightsData: {[itemName: string]: string}) => {
        setIsLoading(true);

        console.log('\n=== HANDLE PREPARED DEBUG ===');
        console.log('Received preparingWeightsData:', preparingWeightsData);
        console.log('Order itemQuantities:', order.itemQuantities);
        console.log('Order itemWeights:', order.itemWeights);
        console.log('Butcher type:', isMeatButcher(butcherId) ? 'meat' : 'fish');
        console.log('=====================================\n');

        // Calculate total preparing weight and revenue
        const totalPreparingWeight = Object.values(preparingWeightsData).reduce((sum, w) => sum + parseFloat(w), 0);
        
        // Calculate revenue based on purchase prices from menu pos sheet
        // Formula: (Purchase Price × Weight) - Commission% of (Purchase Price × Weight)
        let totalRevenue = 0;
        const itemRevenues: {[itemName: string]: number} = {};
        
        // Load custom rates from Google Sheets
        const customRates = await getRatesFromSheet();
        const butcherCustomRates = customRates.find(r => r.butcherId === butcherId);
        console.log('Loaded custom rates for butcher:', butcherId, butcherCustomRates);
        
        try {
            // Fetch actual purchase prices from Menu POS sheet via API
            const itemNames = Object.keys(preparingWeightsData);
            const orderItemsParam = encodeURIComponent(JSON.stringify(order.items));
            console.log('Fetching purchase prices for items:', itemNames);
            console.log('Order items:', order.items);
            
            const response = await fetch(`/api/purchase-prices/${butcherId}?items=${itemNames.join(',')}&orderItems=${orderItemsParam}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                const prices = data.prices || {};
        console.log('\n=== REVENUE CALCULATION DEBUG ===');
                console.log('API Response:', data);
                console.log('Prices received from API:', prices);
                console.log('Number of prices received:', Object.keys(prices).length);
                console.log('Price keys:', Object.keys(prices));
        console.log('Order details:', {
            orderId: order.id,
            orderStatus: order.status,
            orderItemWeights: order.itemWeights,
            orderPickedWeight: order.pickedWeight,
            orderItems: order.items.map(item => ({ name: item.name, quantity: item.quantity }))
        });
        console.log('Fetched purchase prices from sheet:', {
            prices,
            itemNames: Object.keys(preparingWeightsData),
            butcherId,
            responseData: data,
            preparingWeightsData
        });
                
                // Calculate revenue using actual purchase prices from sheet with size consideration
                Object.entries(preparingWeightsData).forEach(([itemName, itemWeight]) => {
                    const orderItem = order.items.find(item => item.name === itemName);
                    if (orderItem) {
                        // Enhanced item name matching for purchase price lookup
                        let lookupName = itemName;
                        if (isFishButcher(butcherId) && itemName.includes(' - ')) {
                            const nameParts = itemName.split(' - ');
                            if (nameParts.length >= 3) {
                                lookupName = nameParts[1].trim(); // Use English name for lookup
                            }
                        }
                        
                        // For fish butchers' meat category items, add "meat" suffix
                        const itemCategoryForLookup = orderItem.category || '';
                        const isMeatCategoryItem = isFishButcher(butcherId) && itemCategoryForLookup.toLowerCase().includes('meat');
                        
                        // Get size information from order item
                        const orderItemSize = orderItem.size?.toLowerCase().trim() || 'default';
                        
                        // Case-sensitive matching for exact item names in menu POS sheet with size consideration
                        let purchasePrice = 450; // Default fallback
                        let matchedKey = 'none';
                        
                        if (isMeatButcher(butcherId)) {
                            // Meat butchers: Case-sensitive exact matching (no size consideration)
                            if (prices[itemName] && prices[itemName] > 0) {
                                purchasePrice = prices[itemName];
                                matchedKey = itemName;
                            }
                        } else {
                            // Fish butchers: Enhanced matching with size consideration
                            // First, try exact case-sensitive match with English name and size
                            if (orderItemSize && orderItemSize !== 'default') {
                                const keyWithSize = `${lookupName} (${orderItemSize})`;
                                if (prices[keyWithSize] && prices[keyWithSize] > 0) {
                                    purchasePrice = prices[keyWithSize];
                                    matchedKey = keyWithSize;
                                }
                            }
                            
                            // If no size-specific match, try without size
                            if (matchedKey === 'none') {
                            if (prices[lookupName] && prices[lookupName] > 0) {
                                purchasePrice = prices[lookupName];
                                matchedKey = lookupName;
                            }
                            // If meat category item, try with "meat" suffix (case-sensitive)
                            else if (isMeatCategoryItem && prices[`${lookupName} meat`] && prices[`${lookupName} meat`] > 0) {
                                purchasePrice = prices[`${lookupName} meat`];
                                matchedKey = `${lookupName} meat`;
                            }
                            // Try original item name (case-sensitive)
                            else if (prices[itemName] && prices[itemName] > 0) {
                                purchasePrice = prices[itemName];
                                matchedKey = itemName;
                            }
                            // If meat category item, try original name with "meat" suffix (case-sensitive)
                            else if (isMeatCategoryItem && prices[`${itemName} meat`] && prices[`${itemName} meat`] > 0) {
                                purchasePrice = prices[`${itemName} meat`];
                                matchedKey = `${itemName} meat`;
                                }
                            }
                        }
                        
                        // Debug logging for price matching
                        console.log(`Price lookup for ${itemName}:`, {
                            itemName,
                            lookupName,
                            itemCategory: itemCategoryForLookup,
                            orderItemSize,
                            isMeatCategoryItem,
                            matchedKey,
                            matchedPrice: purchasePrice,
                            allPrices: prices,
                            availableKeys: Object.keys(prices)
                        });
                        
                        // Check for duplicate items (like Vatta in both sea water and meat)
                        const duplicateItems = Object.keys(prices).filter(key => 
                            key.toLowerCase().includes('trevally') || 
                            key.toLowerCase().includes('vatta') ||
                            key.toLowerCase().includes('sravu') ||
                            key.toLowerCase().includes('kera')
                        );
                        
                        console.log(`Price lookup for ${itemName}:`, {
                            itemName,
                            lookupName,
                            itemCategory: itemCategoryForLookup,
                            isFishButcher: isFishButcher(butcherId),
                            fullName: isFishButcher(butcherId) ? getFishItemFullName(itemName) : 'N/A',
                            matchedKey,
                            matchedPrice: purchasePrice,
                            duplicateItems,
                            allPrices: prices,
                            availableKeys: Object.keys(prices),
                            isUsingFallback: purchasePrice === 450
                        });
                        
                        // Use preparing weight for all items
                        const weight = parseFloat(itemWeight);
                        
                        // Get commission rate for this item's category (using custom rates from Google Sheets)
                        const commissionCategory = orderItem.category || 'default';
                        const commission = getCommissionRate(butcherId, commissionCategory, butcherCustomRates?.commissionRates);
                        
                        // Revenue calculation formula: (preparing weight × purchase price) - commission rate
                        // This works for both kg and nos units
                        const totalPrice = weight * purchasePrice; // Total price before commission
                        const commissionAmount = totalPrice * commission; // Commission amount
                        const itemRevenue = totalPrice - commissionAmount; // Final revenue for butcher
                        
                        // Debug logging for unit handling
                        console.log(`Unit handling for ${itemName}:`, {
                            itemName,
                            weight,
                            unit: orderItem.unit,
                            purchasePrice,
                            totalPrice,
                            commission,
                            commissionAmount,
                            itemRevenue,
                            calculation: `${weight} ${orderItem.unit} × ₹${purchasePrice} = ₹${totalPrice} - ₹${commissionAmount} = ₹${itemRevenue}`
                        });
                        
                        // Debug: Check if this makes sense
                        if (order.id === 'ORD-10') {
                            console.log(`\n🔍 ORDER 10 REVENUE CALCULATION CHECK:`);
                            console.log(`- Item Name: ${itemName}`);
                            console.log(`- Lookup Name: ${lookupName}`);
                            console.log(`- Item Category: ${itemCategoryForLookup}`);
                            console.log(`- Matched Key: ${matchedKey}`);
                            console.log(`- Purchase Price: ${purchasePrice} (per kg)`);
                            console.log(`- Weight: ${weight} kg`);
                            console.log(`- Total Price: ${totalPrice} (total price before commission)`);
                            console.log(`- Commission: ${commission * 100}%`);
                            console.log(`- Butcher Revenue: ${itemRevenue}`);
                            console.log(`- If selling price is 440, then:`);
                            console.log(`  - Either purchase price should be ${440/weight} per kg`);
                            console.log(`  - Or weight should be ${440/purchasePrice} kg`);
                            console.log(`  - Or we're using wrong purchase price`);
                            console.log(`- Duplicate items found:`, duplicateItems);
                            console.log(`- All available prices:`, Object.keys(prices));
                            console.log(`- This might be a duplicate item issue (Vatta in both sea water and meat)`);
                            console.log(`- With the new "meat" suffix solution, this should be resolved!`);
                            console.log(`🔍 END CHECK\n`);
                        }
                        
                        console.log(`Revenue calculation for ${itemName}:`, {
                            purchasePrice,
                            weight,
                            totalPrice,
                            commission,
                            commissionAmount,
                            itemRevenue,
                            butcherId: butcherId,
                            commissionRate: commission,
                            unit: orderItem.unit,
                            calculation: `${weight} × ${purchasePrice} = ${totalPrice} - ${commissionAmount} = ${itemRevenue}`,
                            stepByStep: {
                                step1: `${weight} × ${purchasePrice} = ${totalPrice} (total price)`,
                                step2: `${totalPrice} × ${commission} = ${commissionAmount} (commission amount)`,
                                step3: `${totalPrice} - ${commissionAmount} = ${itemRevenue} (butcher's revenue)`
                            },
                            expectedTotalPrice: totalPrice,
                            expectedButcherRevenue: itemRevenue
                        });
                        
                        // Special debugging for Order 10 and 11
                        if (order.id === 'ORD-10' || order.id === 'ORD-11') {
                            console.log(`\n🚨 REVENUE ISSUE DEBUG for Order ${order.id} 🚨`);
                            console.log('Expected selling price: 440');
                            console.log('Current revenue showing: 459');
                            console.log('This is WRONG - revenue should be LESS than selling price!');
                            console.log('Debugging calculation:');
                            console.log(`- Purchase Price: ${purchasePrice}`);
                            console.log(`- Weight: ${weight}`);
                            console.log(`- Total Price: ${totalPrice}`);
                            console.log(`- Commission Rate: ${commission} (${commission * 100}%)`);
                            console.log(`- Commission Amount: ${commissionAmount}`);
                            console.log(`- Butcher Revenue: ${itemRevenue}`);
                            console.log(`- Expected: If selling price is 440, butcher revenue should be ~${440 * (1 - commission)}`);
                            console.log('🚨 END DEBUG 🚨\n');
                            console.log(`=== ORDER ${order.id} SPECIAL DEBUG ===`);
                            console.log(`Order ${order.id} details:`, {
                                orderId: order.id,
                                itemName,
                                purchasePrice: purchasePrice.toString(),
                                weight: weight.toString(),
                                totalValue: (purchasePrice * weight).toString(),
                                commission: commission.toString(),
                                calculatedRevenue: ((purchasePrice * weight) * (1 - commission)).toString(),
                                expectedCalculation: {
                                    step1: '229 × 1.5 = 343.50',
                                    step2: '343.50 × 0.10 = 34.35 (commission)',
                                    step3: '343.50 - 34.35 = 309.15 (final revenue)'
                                }
                            });
                            console.log('==============================');
                        }
                        
                        // Special debugging for Order 20
                        if (order.id === 'ORD-20') {
                            console.log('=== ORDER 20 SPECIAL DEBUG ===');
                            console.log('Order 20 details:', {
                                orderId: order.id,
                                itemName,
                                purchasePrice: purchasePrice.toString(),
                                weight: weight.toString(),
                                totalValue: (purchasePrice * weight).toString(),
                                commission: commission.toString(),
                                calculatedRevenue: ((purchasePrice * weight) * (1 - commission)).toString(),
                                expectedPrices: {
                                    'chicken breast boneless': 389,
                                    'chicken leg': 259
                                },
                                allPrices: prices
                            });
                            console.log('==============================');
                        }
                        
                        itemRevenues[itemName] = itemRevenue;
                        totalRevenue += itemRevenue;
                    }
                });
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('API response not ok:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData
                });
                throw new Error(`Failed to fetch purchase prices: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error fetching purchase prices, using fallback:', error);
            
            // Only run fallback if no revenue was calculated in the main loop
            if (totalRevenue === 0) {
                console.log('No revenue calculated in main loop, using fallback calculation');
                
                // Fallback calculation using default prices
                Object.entries(preparingWeightsData).forEach(([itemName, itemWeight]) => {
                    const orderItem = order.items.find(item => item.name === itemName);
                    
                    // For fish butchers, extract English name for consistency
                    let lookupName = itemName;
                    if (isFishButcher(butcherId) && itemName.includes(' - ')) {
                        const nameParts = itemName.split(' - ');
                        if (nameParts.length >= 3) {
                            lookupName = nameParts[1].trim(); // Get English name (middle part)
                        }
                    }
                    
                    const purchasePrice = 450; // Default purchase price
                    
                    // Use preparing weight for all items (works for both kg and nos)
                    const weight = parseFloat(itemWeight);
                    
                    // Get commission rate for this item's category (using custom rates from Google Sheets)
                    const commissionCategory = orderItem?.category || 'default';
                    const commission = getCommissionRate(butcherId, commissionCategory, butcherCustomRates?.commissionRates);
                    
                    // Revenue calculation formula: (preparing weight × purchase price) - commission rate
                    // This works for both kg and nos units
                    const totalPrice = weight * purchasePrice; // Total price before commission
                    const commissionAmount = totalPrice * commission; // Commission amount
                    const itemRevenue = totalPrice - commissionAmount; // Final revenue for butcher
                    
                    console.log(`Fallback calculation for ${itemName}:`, {
                        itemName,
                        weight,
                        unit: orderItem?.unit || 'kg',
                        purchasePrice,
                        totalPrice,
                        commission,
                        commissionAmount,
                        itemRevenue,
                        calculation: `${weight} ${orderItem?.unit || 'kg'} × ₹${purchasePrice} = ₹${totalPrice} - ₹${commissionAmount} = ₹${itemRevenue}`
                    });
                    
                    itemRevenues[itemName] = itemRevenue;
                    totalRevenue += itemRevenue;
                });
            } else {
                console.log('Revenue already calculated in main loop, skipping fallback');
            }
        }
        
        const revenue = totalRevenue;
        
        console.log('\n=== REVENUE CALCULATION SUMMARY ===');
        console.log(`Butcher: ${butcherId}`);
        console.log(`Total Revenue: ₹${revenue.toFixed(2)}`);
        console.log(`Item Revenues:`, itemRevenues);
        console.log(`Preparing Weights:`, preparingWeightsData);
        console.log(`Revenue Type: ${typeof revenue}`);
        console.log(`Revenue Value: ${revenue}`);
        console.log(`Is Revenue Valid: ${!isNaN(revenue) && revenue > 0}`);
        console.log('=====================================\n');
        
        const preparationEndTime = new Date();
        const completionTime = order.preparationStartTime ? 
            Math.max(5, Math.round((preparationEndTime.getTime() - order.preparationStartTime.getTime()) / 60000)) : // Convert to minutes, minimum 5 minutes
            5; // Default to 5 minutes if no start time
        
        console.log('Order completion calculation DEBUG:', {
            orderId: order.id,
            hasPreparationStartTime: !!order.preparationStartTime,
            preparationStartTime: order.preparationStartTime,
            preparationStartTimeType: typeof order.preparationStartTime,
            preparationEndTime,
            completionTimeMs: preparationEndTime.getTime() - (order.preparationStartTime?.getTime() || 0),
            completionTimeMinutes: completionTime,
            orderStatus: order.status,
            preparingWeightsData,
            totalPreparingWeight,
            itemRevenues,
            totalRevenue: revenue
        });
        
        const updatedOrder: Order = { 
            ...order, 
            status: 'completed', // Changed from 'prepared' to 'completed'
            preparationEndTime, 
            // Store weights in the correct field based on butcher type
            ...(isMeatButcher(butcherId) 
                ? { itemQuantities: preparingWeightsData } 
                : { itemWeights: preparingWeightsData }
            ),
            // Update pickedWeight to reflect the actual weights being used for completion
            pickedWeight: totalPreparingWeight, // Use the actual preparing weights
            revenue,
            itemRevenues, // Store individual item revenues
            completionTime // Add completion time in minutes
        };
        
        try {
          console.log('Updating order with data:', {
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            revenue: updatedOrder.revenue,
            itemRevenues: updatedOrder.itemRevenues,
            revenueType: typeof updatedOrder.revenue,
            itemRevenuesType: typeof updatedOrder.itemRevenues,
            hasRevenue: !!updatedOrder.revenue,
            hasItemRevenues: !!updatedOrder.itemRevenues,
            pickedWeight: updatedOrder.pickedWeight,
            itemWeights: updatedOrder.itemWeights,
            itemQuantities: updatedOrder.itemQuantities,
            butcherType: isMeatButcher(butcherId) ? 'meat' : 'fish',
            preparingWeightsData: preparingWeightsData
          });
          
          await onUpdate(updatedOrder);
          
          // Save sales data to Sales VCS sheet via API (only for completed orders)
          if (updatedOrder.status === 'completed') {
            try {
              console.log('\n=== DASHBOARD: Sending sales data for completed order ===');
              console.log('Order ID:', updatedOrder.id);
              console.log('Butcher ID:', butcherId);
              console.log('Order Status:', updatedOrder.status);
              console.log('Order Data:', updatedOrder);
              console.log('Order Items:', updatedOrder.items);
              console.log('Item Quantities:', updatedOrder.itemQuantities);
              console.log('Item Weights:', updatedOrder.itemWeights);
              
              const requestBody = {
                orderId: updatedOrder.id,
                butcherId: butcherId,
                orderData: updatedOrder
              };
              console.log('Request body being sent:', JSON.stringify(requestBody, null, 2));
              
              const salesResponse = await fetch('/api/sales-data', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });
              
              console.log('Sales API Response Status:', salesResponse.status);
              
              let responseData;
              try {
                responseData = await salesResponse.json();
                console.log('Sales API Response Data:', responseData);
              } catch (jsonError) {
                console.error('❌ Failed to parse response as JSON:', jsonError);
                const responseText = await salesResponse.text();
                console.error('❌ Raw response text:', responseText);
                responseData = { error: 'Invalid JSON response', rawResponse: responseText };
              }
              
              if (salesResponse.ok) {
                console.log('✅ Sales data saved to Sales VCS sheet for completed order:', updatedOrder.id);
                toast({ 
                  title: "Order Completed Successfully", 
                  description: `Order ${getDisplayOrderId(updatedOrder.id)} completed and synced to all sheets.`,
                  variant: "default"
                });
              } else {
                console.error('❌ Failed to save sales data to Sales VCS sheet. Response status:', salesResponse.status);
                console.error('❌ Response data:', responseData);
                console.error('❌ Response headers:', Object.fromEntries(salesResponse.headers.entries()));
                
                // Show error to user since this is important for analytics
                const errorMessage = responseData?.details || responseData?.error || `HTTP ${salesResponse.status}`;
                toast({
                  variant: "destructive",
                  title: "Sales Data Upload Failed",
                  description: `Failed to upload sales data for order ${getDisplayOrderId(updatedOrder.id)}: ${errorMessage}`
                });
              }
            } catch (error) {
              console.error('❌ Error saving sales data to Sales VCS sheet:', error);
              console.error('Error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : undefined,
                orderId: updatedOrder.id,
                butcherId: butcherId,
                status: updatedOrder.status
              });
              
              // Show error to user since this is important for analytics
              const errorMessage = error instanceof Error ? error.message : String(error);
              toast({
                variant: "destructive",
                title: "Sales Data Upload Error",
                description: `Error uploading sales data for order ${getDisplayOrderId(updatedOrder.id)}: ${errorMessage}`
              });
            }
          } else {
            console.log('⚠️ Order not completed yet, skipping sales data upload. Status:', updatedOrder.status);
          }
          
          // Immediately refetch orders to update UI
          refetch();
          toast({ 
              title: "Order Prepared", 
              description: `${getDisplayOrderId(order.id)} is ready and saved to sheet.`,
              variant: "success"
          });
        } catch (error) {
          console.error('Error updating order:', error);
          toast({ 
            variant: "destructive", 
            title: "API Error", 
            description: `Failed to save order to sheet: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        } finally {
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

    const statusStyling = getStatusStyling();
    const StatusIcon = statusStyling.icon;

    return (
        <>
            <Card className={cn(
                "group transition-all duration-200",
                isOverdue ? "border-red-500/50 bg-red-50 dark:bg-red-950/20" : "bg-white dark:bg-gray-900",
                statusStyling.cardClass
            )}>
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                {getDisplayOrderId(order.id)}
                            </CardTitle>
                            <CardDescription className="text-base font-medium text-muted-foreground">
                                {order.customerName}
                            </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                        {order.status === 'preparing' && order.preparationStartTime && <CountdownTimer startTime={order.preparationStartTime} orderStatus={order.status} />}
                            
                            {/* Dynamic Status Badge */}
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-1 rounded-md font-medium text-sm",
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
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {order.items.map((item, index) => (
                            <div key={item.id} className="group/item p-4 rounded-xl bg-gradient-to-r from-muted/30 to-muted/10 border border-border/50 hover:border-primary/20 transition-all duration-200 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-foreground text-base">
                                                {getItemDisplayName(item.name, butcherId)}
                                            </span>
                                            <span className="text-muted-foreground text-sm font-medium">
                                                ({item.quantity} {item.unit})
                                            </span>
                                            {item.size && (
                                                <span className="text-primary text-sm font-medium bg-primary/10 px-2 py-1 rounded-md">
                                                    Size: {item.size}
                                                </span>
                                            )}
                                        </div>
                                        {order.pickedWeight && !isArchived && (
                                            <div className="flex items-center gap-2">
                                                <Weight className="h-4 w-4 text-primary" />
                                                <span className="text-sm font-semibold text-primary">
                                                    Picked: {getDisplayWeight(order, butcherId).toFixed(2)}kg
                                                </span>
                                            </div>
                                        )}
                                        
                                        <div className="flex gap-2 flex-wrap">
                                            {item.size && (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 shadow-sm">
                                                    <PackageCheck className="h-3 w-3" />
                                                    Size: {item.size}
                                                </span>
                                            )}
                                            {item.cutType && (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shadow-sm">
                                                    <CookingPot className="h-3 w-3" />
                                                    Cut: {item.cutType}
                                                </span>
                                            )}
                                    </div>
                                </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    


                     {isArchived && (order.status === 'prepared' || order.status === 'completed') && (
                        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-muted/20 to-muted/10 border border-border/30 space-y-3">
                            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wide">Order Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {order.pickedWeight && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                                            <Weight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                                        <div>
                                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Picked Weight</p>
                                            <p className="text-sm font-bold text-blue-800 dark:text-blue-200">{getDisplayWeight(order, butcherId).toFixed(2)}kg</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30">
                                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40">
                                        <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Prep Time</p>
                                        <p className="text-sm font-bold text-green-800 dark:text-green-200">{getPrepTime(order.preparationStartTime, order.preparationEndTime)}</p>
                                    </div>
                            </div>
                            {order.revenue && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                            <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Revenue</p>
                                            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">₹{order.revenue.toFixed(2)}</p>
                                        </div>
                                </div>
                            )}
                            </div>
                        </div>
                    )}
                    {order.address && (
                        <div className="text-base text-muted-foreground mt-4 pt-4 border-t flex items-start gap-2">
                           <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> 
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
                                disabled={isLoading}
                                className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:border-red-800 dark:hover:text-red-400 transition-all duration-200 shadow-modern hover:shadow-modern-lg disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <ThumbsDown className="mr-2 h-4 w-4" /> 
                                        Reject
                                    </>
                                )}
                            </Button>
                            <Button 
                                size="sm" 
                                onClick={handleAccept}
                                className="bg-gradient-primary hover:shadow-modern-lg transition-all duration-200 text-primary-foreground font-semibold"
                            >
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
                                // For items that went through weight dialog, always use the custom weights
                                // For other items, use original quantities
                                const weightsToUse: {[key: string]: string} = {};
                                
                                order.items.forEach(item => {
                                    if (order.itemQuantities && order.itemQuantities[item.name]) {
                                        // Use custom entered weight if available
                                        weightsToUse[item.name] = order.itemQuantities[item.name];
                                        console.log(`Using custom weight for ${item.name}: ${order.itemQuantities[item.name]}`);
                                    } else {
                                        // Use original quantity for items that didn't go through weight dialog
                                        weightsToUse[item.name] = item.quantity.toString();
                                        console.log(`Using original quantity for ${item.name}: ${item.quantity}`);
                                    }
                                });
                                
                                console.log('\n=== MEAT BUTCHER MARK AS PREPARED ===');
                                console.log('Order itemQuantities:', order.itemQuantities);
                                console.log('Final weights to use:', weightsToUse);
                                console.log('=====================================\n');
                                
                                handlePrepared(weightsToUse);
                            } else {
                                // Fish butchers: Use itemWeights for revenue calculation
                                // For items that went through weight dialog, always use the custom weights
                                // For other items, use original quantities
                                const weightsToUse: {[key: string]: string} = {};
                                
                                order.items.forEach(item => {
                                    if (order.itemWeights && order.itemWeights[item.name]) {
                                        // Use custom entered weight if available
                                        weightsToUse[item.name] = order.itemWeights[item.name];
                                        console.log(`Using custom weight for ${item.name}: ${order.itemWeights[item.name]}`);
                                    } else {
                                        // Use original quantity for items that didn't go through weight dialog
                                        weightsToUse[item.name] = item.quantity.toString();
                                        console.log(`Using original quantity for ${item.name}: ${item.quantity}`);
                                    }
                                });
                                
                                console.log('\n=== FISH BUTCHER MARK AS PREPARED ===');
                                console.log('Order itemWeights:', order.itemWeights);
                                console.log('Final weights to use:', weightsToUse);
                                console.log('=====================================\n');
                                
                                handlePrepared(weightsToUse);
                            }
                            }} 
                            disabled={isLoading}
                            className="bg-gradient-success hover:shadow-modern-lg transition-all duration-200 text-white font-semibold disabled:opacity-50"
                        >
                           {isLoading ? (
                               <>
                                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                   Saving...
                               </>
                           ) : (
                               <>
                                   <CheckCircle className="mr-2 h-4 w-4" />
                                   Mark as Prepared
                               </>
                           )}
                        </Button>
                    )}
                </CardFooter>
            </Card>



            
        </>
    );
};

export default function OrderManagementPage() {
  const { butcher } = useAuth();
  const { toast } = useToast();
  const { updateOrder } = useOrderUpdate();
  // Removed useOrderAlert - using global alert system from layout instead

  // Global dialog state to prevent reset during polling
  const [globalDialogState, setGlobalDialogState] = useState<{
    [orderId: string]: {
      isOpen: boolean;
      weights: {[itemName: string]: string};
      unit: 'kg' | 'g';
      currentIndex: number;
      rejectDialog?: {
        isOpen: boolean;
        reason: string;
      };
    }
  }>({});

  // Current dialog order data
  const [currentDialogOrder, setCurrentDialogOrder] = useState<Order | null>(null);

  // Use polling hook with 5-second interval for real-time updates
  const { orders: allOrders, isLoading, error, refetch } = useOrderPolling({
    butcherId: butcher?.id || '',
    pollingInterval: 5000, // 5 seconds for real-time updates as requested
    enabled: !!butcher
  });

  // Show error if there's an issue fetching orders
  useEffect(() => {
    if (error) {
      toast({ 
        variant: "destructive", 
        title: "Failed to fetch orders", 
        description: error 
      });
    }
  }, [error, toast]);
  
  // Filter orders to show only today's orders
  const today = new Date();
  const todayString = today.toDateString();
  
  const todayOrders = allOrders.filter(order => {
    const orderDate = new Date(order.orderTime);
    const isToday = orderDate.toDateString() === todayString;
    console.log(`Order ${order.id}: date=${orderDate.toDateString()}, today=${todayString}, isToday=${isToday}, status=${order.status}`);
    return isToday;
  });
  
  console.log('=== ORDER FILTERING DEBUG ===');
  console.log('Total orders:', allOrders.length);
  console.log('Today orders:', todayOrders.length);
  console.log('Today string:', todayString);
  
  const newOrders = todayOrders.filter(o => o.status === 'new');
  const preparingOrders = todayOrders.filter(o => o.status === 'preparing');
  const archivedOrders = todayOrders.filter(o => ['prepared', 'completed', 'ready to pick up', 'rejected'].includes(o.status) || o.rejectionReason);
  
  console.log('New orders:', newOrders.length);
  console.log('Preparing orders:', preparingOrders.length);
  console.log('Archived orders:', archivedOrders.length);
  console.log('Archived orders list:', archivedOrders.map(o => ({ id: o.id, status: o.status })));
  console.log('=== END ORDER FILTERING DEBUG ===');

  
  const handleOrderUpdate = async (updatedOrder: Order) => {
    if (!butcher) return;
  
    try {
      console.log('=== HANDLE ORDER UPDATE START ===');
      console.log('Updating order:', updatedOrder.id, 'to status:', updatedOrder.status);
      
      // Update in Google Sheets first
      await updateOrder(butcher!.id, updatedOrder);
      console.log('Order updated successfully in sheets');
    
      // Immediate refresh to get updated data from server
      console.log('Refetching orders...');
      await refetch();
      console.log('Orders refetched successfully');
      console.log('=== HANDLE ORDER UPDATE END ===');

      
    } catch (error: any) {
      console.error('=== HANDLE ORDER UPDATE ERROR ===');
      console.error('Error updating order:', error);
      toast({
        variant: "destructive",
        title: "Failed to update order",
        description: error.message || "Please try again."
      });
    }
  };
  
  const TabContent = ({ orders, icon: Icon, title, description, showSkeleton, isArchived, refetch, allOrders, globalDialogState, setGlobalDialogState, setCurrentDialogOrder }: { orders: Order[], icon: React.ElementType, title: string, description: string, showSkeleton?: boolean, isArchived?: boolean, refetch: () => Promise<void>; allOrders: Order[]; globalDialogState: any; setGlobalDialogState: any; setCurrentDialogOrder: any }) => (
    <div className="space-y-4">
        {showSkeleton ? (
            <div className="grid gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i}>
                        <OrderCardSkeleton />
                    </div>
                ))}
            </div>
        ) : orders.length > 0 ? (
            <div className="grid gap-4">
                {orders.map((order) => (
                    <div key={order.id}>
                        <OrderCard order={order} onUpdate={handleOrderUpdate} butcherId={butcher!.id} isArchived={isArchived} butcherMenu={butcher!.menu} refetch={refetch} allOrders={allOrders} globalDialogState={globalDialogState} setGlobalDialogState={setGlobalDialogState} setCurrentDialogOrder={setCurrentDialogOrder} />
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-16 px-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <Icon className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">{description}</p>
            </div>
        )}
    </div>
  );

  if (!butcher) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modern Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-primary shadow-modern">
              <CookingPot className="h-6 w-6 text-primary-foreground" />
        </div>
          <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Order Management
              </h1>
              <p className="text-muted-foreground font-medium">
                Today's orders only - View historical orders in Analytics
              </p>
          </div>
        </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refetch} 
            disabled={isLoading}
            className="hover:shadow-modern transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>


      {/* Modern Tabs */}
      <Tabs defaultValue="new" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl shadow-modern">
          <TabsTrigger 
            value="new" 
            className="rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-modern transition-all duration-200 font-semibold"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-slow" />
              New ({newOrders.length})
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="preparing" 
            className="rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-modern transition-all duration-200 font-semibold"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse-slow" />
              Preparing ({preparingOrders.length})
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="archived" 
            className="rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-modern transition-all duration-200 font-semibold"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Completed ({archivedOrders.length})
            </div>
          </TabsTrigger>
        </TabsList>

      <TabsContent value="new">
        <TabContent orders={newOrders} icon={CookingPot} title="No new orders today" description="New orders from customers will appear here. Only today's orders are shown." showSkeleton={isLoading && newOrders.length === 0} refetch={refetch} allOrders={allOrders} globalDialogState={globalDialogState} setGlobalDialogState={setGlobalDialogState} setCurrentDialogOrder={setCurrentDialogOrder} />
      </TabsContent>
      <TabsContent value="preparing">
        <TabContent orders={preparingOrders} icon={PackageCheck} title="No orders in preparation today" description="Accepted orders will be displayed here. Only today's orders are shown." showSkeleton={isLoading && preparingOrders.length === 0} refetch={refetch} allOrders={allOrders} globalDialogState={globalDialogState} setGlobalDialogState={setGlobalDialogState} setCurrentDialogOrder={setCurrentDialogOrder} />
      </TabsContent>
      <TabsContent value="archived">
          <TabContent orders={archivedOrders} icon={AlertCircle} title="No completed orders today" description="Completed and rejected orders are shown here. Only today's orders are shown." showSkeleton={isLoading && archivedOrders.length === 0} isArchived={true} refetch={refetch} allOrders={allOrders} globalDialogState={globalDialogState} setGlobalDialogState={setGlobalDialogState} setCurrentDialogOrder={setCurrentDialogOrder} />
      </TabsContent>
    </Tabs>
    
    {/* Global Weight Dialog - Rendered outside of polling-affected components */}
    {/* Reject Dialog */}
    {allOrders.map((order) => {
      const rejectDialogState = globalDialogState[order.id]?.rejectDialog;
      if (rejectDialogState?.isOpen) {
        return (
          <RejectDialog
            key={`reject-${order.id}`}
            order={order}
            rejectDialogState={rejectDialogState}
            updateRejectDialogState={(updates) => setGlobalDialogState((prev: any) => ({
              ...prev,
              [order.id]: {
                ...prev[order.id],
                rejectDialog: {
                  ...prev[order.id]?.rejectDialog,
                  ...updates
                }
              }
            }))}
            handleReject={async () => {
              const rejectionReason = rejectDialogState.reason;
              if (!rejectionReason.trim()) {
                toast({ 
                  variant: "destructive", 
                  title: "Reason Required", 
                  description: "Please provide a reason for declining this order." 
                });
                return;
              }

              try {
                const updatedOrder = { ...order, status: 'rejected' as const, rejectionReason };
                await handleOrderUpdate(updatedOrder);
                
                // Close dialog and reset state
                setGlobalDialogState((prev: any) => ({
                  ...prev,
                  [order.id]: {
                    ...prev[order.id],
                    rejectDialog: { isOpen: false, reason: '' }
                  }
                }));
                
                toast({ 
                  title: "Order Declined", 
                  description: `${getDisplayOrderId(order.id)} has been declined.`,
                  variant: "destructive"
                });
              } catch (error) {
                console.error('Error rejecting order:', error);
                toast({ 
                  variant: "destructive", 
                  title: "Error", 
                  description: "Failed to reject order. Please try again." 
                });
              }
            }}
            onClose={() => {
              setGlobalDialogState((prev: any) => ({
                ...prev,
                [order.id]: {
                  ...prev[order.id],
                  rejectDialog: { isOpen: false, reason: '' }
                }
              }));
            }}
            isLoading={false}
          />
        );
      }
      return null;
    })}

    {currentDialogOrder && globalDialogState[currentDialogOrder.id] && (
      <WeightDialog
        order={currentDialogOrder}
        butcherId={butcher!.id}
        dialogState={globalDialogState[currentDialogOrder.id]}
        updateDialogState={(updates) => setGlobalDialogState((prev: any) => ({
          ...prev,
          [currentDialogOrder.id]: {
            ...prev[currentDialogOrder.id],
            ...updates
          }
        }))}
        handlePickedWeightSubmit={() => {
          const dialogState = globalDialogState[currentDialogOrder.id];
          const currentItem = currentDialogOrder.items[dialogState.currentIndex];
          if (!currentItem) {
            console.error('No current item found at index:', dialogState.currentIndex);
            return;
          }
          
          const currentWeight = dialogState.weights[currentItem.name] || '';
          let weight = parseFloat(currentWeight);
          
          if (isNaN(weight) || weight <= 0) {
            toast({ 
              variant: "destructive", 
              title: "Validation Error", 
              description: `Please enter a valid picked weight for ${currentItem.name}.` 
            });
            return;
          }
          
          // Validate reasonable weight limits (prevent data entry errors)
          if (weight > 100) {
            toast({ 
              variant: "destructive", 
              title: "Weight Too High", 
              description: `Weight ${weight}kg seems too high. Please check if you meant ${(weight/1000).toFixed(3)}kg or ${weight/1000}kg?` 
            });
            return;
          }
          
          // Convert to kg if needed
          if (dialogState.unit === 'g') {
            weight = weight / 1000;
          }

          // Update the weights object
          const newWeights = { ...dialogState.weights, [currentItem.name]: weight.toString() };

          // Check if we have weights for all items
          if (dialogState.currentIndex < currentDialogOrder.items.length - 1) {
            // Move to next item
            setGlobalDialogState((prev: any) => ({
              ...prev,
              [currentDialogOrder.id]: {
                ...prev[currentDialogOrder.id],
                weights: newWeights,
                currentIndex: prev[currentDialogOrder.id].currentIndex + 1
              }
            }));
            toast({ 
              title: "Weight Saved", 
              description: `Weight for ${currentItem.name} saved. Moving to next item.`,
              variant: "default"
            });
          } else {
            // All weights collected, update the order
            const totalPickedWeight = Object.values(newWeights).reduce((sum: number, w) => sum + parseFloat(w as string), 0);
            
            console.log('\n=== ORDER ACCEPTANCE DEBUG ===');
            console.log('Weights collected:', newWeights);
            console.log('Total picked weight:', totalPickedWeight);
            console.log('Order items:', currentDialogOrder.items.map(item => ({ name: item.name, quantity: item.quantity })));
            console.log('Butcher type:', isMeatButcher(butcher!.id) ? 'meat' : 'fish');
            
            const updatedOrder: Order = { 
              ...currentDialogOrder, 
              status: 'preparing' as const, 
              preparationStartTime: new Date(), 
              pickedWeight: totalPickedWeight as number // Update pickedWeight to reflect custom entered weights
            };
            
            // Store weights differently based on butcher type
            if (isMeatButcher(butcher!.id)) {
              // Meat butchers: Store in itemQuantities
              updatedOrder.itemQuantities = newWeights;
              console.log('Meat butcher - stored in itemQuantities:', updatedOrder.itemQuantities);
            } else {
              // Fish butchers: Store in itemWeights
              updatedOrder.itemWeights = newWeights;
              console.log('Fish butcher - stored in itemWeights:', updatedOrder.itemWeights);
            }
            
            console.log('Updated order:', {
              id: updatedOrder.id,
              status: updatedOrder.status,
              itemQuantities: updatedOrder.itemQuantities,
              itemWeights: updatedOrder.itemWeights,
              pickedWeight: updatedOrder.pickedWeight
            });
            console.log('=====================================\n');
            
            // Close dialog first to prevent any race conditions
            setCurrentDialogOrder(null);
            setGlobalDialogState((prev: any) => ({
              ...prev,
              [currentDialogOrder.id]: {
                isOpen: false,
                weights: {},
                unit: 'kg',
                currentIndex: 0
              }
            }));
            
            // Update order
            handleOrderUpdate(updatedOrder);
            
            // Check if there are still other new orders before stopping alert
            const remainingNewOrders = allOrders.filter(o => o.status === 'new' && o.id !== currentDialogOrder.id);
            console.log('Fish butcher order accepted:', currentDialogOrder.id, '- remaining new orders:', remainingNewOrders.length);
            if (remainingNewOrders.length === 0 && (window as any).globalStopAlert) {
              console.log('No more new orders, stopping alert immediately');
              (window as any).globalStopAlert();
            }
            
            // Show success message
            toast({ 
              title: "Order Accepted", 
              description: `${getDisplayOrderId(currentDialogOrder.id)} is now being prepared with total weight ${(totalPickedWeight as number).toFixed(2)}kg.`,
              variant: "default"
            });
            
            // Refetch orders to update the UI
            setTimeout(async () => {
              await refetch();
            }, 100);
          }
        }}
        onClose={() => {
          setCurrentDialogOrder(null);
          setGlobalDialogState((prev: any) => ({
            ...prev,
            [currentDialogOrder.id]: {
              isOpen: false,
              weights: {},
              unit: 'kg',
              currentIndex: 0
            }
          }));
        }}
      />
    )}
    </div>
  );
}


    
