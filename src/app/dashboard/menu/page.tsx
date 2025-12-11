
"use client"

import { useAuth } from "../../../context/AuthContext"
import { getFishItemFullName, isFishButcher, freshButchers, getButcherType, isMixedButcher, getButcherMenuCategories, getItemTypeFromCategory } from "../../../lib/butcherConfig"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Label } from "../../../components/ui/label"
import { Input } from "../../../components/ui/input"
import { Switch } from "../../../components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { Button } from "../../../components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../components/ui/accordion"
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { useToast } from "../../../hooks/use-toast"
import React, { useState, useEffect } from "react"
import type { Butcher, MenuCategory, MenuItem, MenuItemSize } from "../../../lib/types"
import { saveMenuToSheet, mergeMenuFromSheet } from "../../../lib/sheets"
import { Loader2, RefreshCw, Beef, Fish } from "lucide-react"
import { cn } from "../../../lib/utils"

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

const SizeEditor = ({
  size,
  unit,
  onUpdate
}: {
  size: MenuItemSize,
  unit: 'kg' | 'nos',
  onUpdate: (updatedSize: Partial<MenuItemSize>) => void
}) => {
  return (
    <div className="space-y-3 sm:space-y-4">
      {unit === 'kg' ? (
        <div className="space-y-2">
          <Label htmlFor={`price-${size.id}`} className="text-xs sm:text-sm">Price per kg (₹)</Label>
          <Input 
            id={`price-${size.id}`} 
            type="number" 
            value={size.price}
            className="text-sm sm:text-base"
            onChange={(e) => {
              const inputValue = e.target.value;
              const parsedPrice = parseFloat(inputValue) || 0;
              onUpdate({ price: parsedPrice });
            }}
            onBlur={(e) => {
              const inputValue = e.target.value;
              const parsedPrice = parseFloat(inputValue) || 0;
              onUpdate({ price: parsedPrice });
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label htmlFor={`price-nos-${size.id}`} className="text-xs sm:text-sm">Price per Piece (₹)</Label>
            <Input 
              id={`price-nos-${size.id}`} 
              type="number" 
              value={size.price}
              className="text-sm sm:text-base"
              onChange={(e) => {
                const inputValue = e.target.value;
                const parsedPrice = parseFloat(inputValue) || 0;
                onUpdate({ price: parsedPrice });
              }}
              onBlur={(e) => {
                const inputValue = e.target.value;
                const parsedPrice = parseFloat(inputValue) || 0;
                onUpdate({ price: parsedPrice });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`min-weight-${size.id}`} className="text-xs sm:text-sm">Min Weight (kg)</Label>
            <Input 
              id={`min-weight-${size.id}`} 
              type="number" 
              step="0.01"
              min="0"
              value={size.minWeight || ''}
              className="text-sm sm:text-base"
              onChange={(e) => {
                const value = e.target.value;
                onUpdate({ minWeight: value === '' ? undefined : parseFloat(value) });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`max-weight-${size.id}`} className="text-xs sm:text-sm">Max Weight (kg)</Label>
            <Input 
              id={`max-weight-${size.id}`} 
              type="number" 
              step="0.01"
              min="0"
              value={size.maxWeight || ''}
              className="text-sm sm:text-base"
              onChange={(e) => {
                const value = e.target.value;
                onUpdate({ maxWeight: value === '' ? undefined : parseFloat(value) });
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}


const MenuItemEditor = ({ item, onUpdate, onRemoveSize, butcherId, categoryName }: { 
  item: MenuItem, 
  onUpdate: (updatedItem: Partial<MenuItem>) => void,
  onRemoveSize: (sizeId: string) => void,
  butcherId: Butcher['id'],
  categoryName: string,
}) => {
  const handleSizeUpdate = (sizeId: string, updatedSize: Partial<MenuItemSize>) => {
    const newSizes = item.sizes.map(s => s.id === sizeId ? { ...s, ...updatedSize } : s);
    
    // Check if any size has a non-zero price
    const hasAnyPrice = newSizes.some(size => size.price > 0);
    
    // Update both sizes and availability
    // Auto-update availability based on price: if any size has price > 0, item is available
    onUpdate({ 
      sizes: newSizes,
      available: hasAnyPrice
    });
  };
  
  const TabsValue = (item.sizes && item.sizes.length > 0) ? item.sizes[0].id : "new";
  
  const isMeatCategory = categoryName.toLowerCase() === 'steak fish';
  
  // Determine if this is a fish category (for mixed butchers)
  const isFishCategory = getItemTypeFromCategory(categoryName) === 'fish';
  
  // For fish butchers OR mixed butchers viewing fish categories, show all three sizes (small, medium, big)
  // For meat products, use only default size
  const isMixed = isMixedButcher(butcherId);
  const hasComplexSizing = (isFishButcher(butcherId) || (isMixed && isFishCategory)) && !isMeatCategory;

  // Initialize sizes if they don't exist
  React.useEffect(() => {
    if (hasComplexSizing && item.sizes.length === 0) {
      // For fish butchers, initialize with all three sizes
      const initialSizes: MenuItemSize[] = [
        { id: `s-${Date.now()}-1`, size: 'small', price: 0 },
        { id: `s-${Date.now()}-2`, size: 'medium', price: 0 },
        { id: `s-${Date.now()}-3`, size: 'big', price: 0 }
      ];
      onUpdate({ 
        sizes: initialSizes,
        available: false // Set as unavailable since all prices are 0
      });
    } else if (!hasComplexSizing && item.sizes.length === 0) {
      // For meat products, initialize with default size
      const initialSize: MenuItemSize = {
        id: `s-${Date.now()}`,
        size: 'default',
        price: 0,
      };
      onUpdate({ 
        sizes: [initialSize],
        available: false // Set as unavailable since price is 0
      });
    }
  }, [hasComplexSizing, item.sizes.length, onUpdate]);

  return (
    <div className="p-3 sm:p-4 border rounded-lg">
      {/* ✅ FIX: Responsive layout for menu item editor */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
        <Label className="font-semibold text-sm sm:text-base break-words">{getItemDisplayName(item.name, butcherId)}</Label>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor={`available-${item.id}`} className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Available</Label>
            <Switch 
              id={`available-${item.id}`} 
              checked={item.available}
              onCheckedChange={(checked) => onUpdate({ available: checked })}
            />
          </div>
          <Select
            value={item.unit}
            onValueChange={(value: 'kg' | 'nos') => onUpdate({ unit: value })}
          >
            <SelectTrigger id={`unit-${item.id}`} className="w-[100px] sm:w-[120px] text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">Weight (kg)</SelectItem>
              <SelectItem value="nos">Numbers (nos)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {item.sizes && item.sizes.length > 0 ? (
        hasComplexSizing ? (
          // For fish butchers, show all three sizes in a grid layout
          <div className="pt-2 sm:pt-4 space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {item.sizes.map(size => (
                <div key={size.id} className="border rounded-lg p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <Label className="font-medium capitalize text-sm sm:text-base">{size.size}</Label>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {size.price > 0 ? 'Available' : 'Not Available'}
                    </div>
                  </div>
                  <SizeEditor 
                    size={size}
                    unit={item.unit}
                    onUpdate={(updatedSize) => handleSizeUpdate(size.id, updatedSize)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Simplified view for default size
          <div className="pt-4">
            <SizeEditor 
              size={item.sizes[0]}
              unit={item.unit}
              onUpdate={(updatedSize) => handleSizeUpdate(item.sizes[0].id, updatedSize)}
            />
          </div>
        )
      ) : (
        <div className="pt-4">
          <div className="text-sm text-muted-foreground">Loading sizes...</div>
        </div>
      )}
    </div>
  )
}

export default function MenuManagementPage() {
  const { butcher, refreshButcherData } = useAuth();
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDataFromSheet, setIsDataFromSheet] = useState(false); // Track if data is loaded from sheet

  // Tab state with session storage persistence (only for mixed butchers)
  const [activeTab, setActiveTab] = useState<'meat' | 'fish'>('meat');
  
  // Initialize tab from session storage when butcher is available (only for mixed butchers)
  useEffect(() => {
    if (butcher && typeof window !== 'undefined') {
      const isMixed = isMixedButcher(butcher.id);
      if (isMixed) {
        const storageKey = `menu-tab-${butcher.id}`;
        const savedTab = sessionStorage.getItem(storageKey);
        const initialTab = (savedTab === 'meat' || savedTab === 'fish') ? savedTab : 'meat';
        setActiveTab(initialTab);
      } else {
        // For non-mixed butchers, set a default (won't affect menu display)
        setActiveTab('meat');
      }
    }
  }, [butcher?.id]);
  
  // Save tab to session storage when it changes (only for mixed butchers)
  useEffect(() => {
    if (butcher && typeof window !== 'undefined') {
      const isMixed = isMixedButcher(butcher.id);
      if (isMixed) {
        const storageKey = `menu-tab-${butcher.id}`;
        sessionStorage.setItem(storageKey, activeTab);
      }
    }
  }, [activeTab, butcher?.id]);

  // Initialize menu: First check sessionStorage, then fallback to butcherConfig
  useEffect(() => {
    if (!butcher) {
      setMenu([]);
      return;
    }
    
    const storageKey = `menu-data-${butcher.id}`;
    const isMixed = isMixedButcher(butcher.id);
    
    // Check if we have persisted menu data in sessionStorage
    if (typeof window !== 'undefined') {
      const savedMenuData = sessionStorage.getItem(storageKey);
      if (savedMenuData) {
        try {
          const parsedMenu = JSON.parse(savedMenuData) as MenuCategory[];
          
          // Validate that we have valid menu data
          if (!Array.isArray(parsedMenu) || parsedMenu.length === 0) {
            // Invalid data, clear and load from config
            sessionStorage.removeItem(storageKey);
            throw new Error('Invalid menu data in storage');
          }
          
          // Deduplicate categories first to prevent duplicate keys
          const uniqueMenu = parsedMenu.reduce((acc, cat) => {
            // Validate category structure
            if (!cat || !cat.id || !cat.name || !Array.isArray(cat.items)) {
              return acc; // Skip invalid categories
            }
            const existingIndex = acc.findIndex(c => c.id === cat.id);
            if (existingIndex >= 0) {
              // Keep the most recent version
              acc[existingIndex] = cat;
            } else {
              acc.push(cat);
            }
            return acc;
          }, [] as MenuCategory[]);
          
          // For mixed butchers, filter by active tab
          if (isMixed) {
            const filteredMenu = uniqueMenu.filter(cat => {
              const categoryType = getItemTypeFromCategory(cat.name);
              const shouldInclude = activeTab === 'meat' 
                ? categoryType === 'meat' 
                : categoryType === 'fish';
              return shouldInclude;
            });
            
            // If filtered menu is empty, check if we should have data for this tab
            if (filteredMenu.length === 0) {
              // Check what categories we actually have in storage
              const meatCategories = uniqueMenu.filter(cat => {
                const categoryType = getItemTypeFromCategory(cat.name);
                return categoryType === 'meat';
              });
              const fishCategories = uniqueMenu.filter(cat => {
                const categoryType = getItemTypeFromCategory(cat.name);
                return categoryType === 'fish';
              });
              
              // If we're on fish tab but only have meat categories (or vice versa), 
              // it means storage is incomplete - clear and reload from config
              if (activeTab === 'fish' && fishCategories.length === 0 && meatCategories.length > 0) {
                // Storage only has meat data, clear it and reload from config to get fish data
                sessionStorage.removeItem(storageKey);
                setMenu([]); // Clear menu state to prevent showing wrong items
                throw new Error('No fish categories in storage, reloading from config');
              } else if (activeTab === 'meat' && meatCategories.length === 0 && fishCategories.length > 0) {
                // Storage only has fish data, clear it and reload from config to get meat data
                sessionStorage.removeItem(storageKey);
                setMenu([]); // Clear menu state to prevent showing wrong items
                throw new Error('No meat categories in storage, reloading from config');
              }
              // If both are empty, clear menu and load from config
              if (meatCategories.length === 0 && fishCategories.length === 0) {
                setMenu([]);
                // Fall through to load from config
              }
            } else {
              // We have valid filtered data, use it
              setMenu(filteredMenu);
              return; // Use saved data, don't load from config
            }
            // If we reach here, filtered menu is empty and we should load from config
        } else {
            setMenu(uniqueMenu);
            return; // Use saved data, don't load from config
          }
        } catch (error: any) {
          // Silently handle the error - we'll load from config instead
          // Only log if it's not our intentional error for missing categories
          if (error.message && !error.message.includes('categories in storage')) {
            console.error('[Menu] Error parsing saved menu data:', error);
          }
          // Clear corrupted data
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(storageKey);
          }
          // Fall through to load from config
        }
      }
    }
    
    // No saved data, load from butcherConfig
    import('../../../lib/butcherConfig').then(({ freshButchers: butchers, getButcherMenuCategories }) => {
      // Try to get menu directly from getButcherMenuCategories for more reliable loading
      const directMenu = getButcherMenuCategories(butcher.id);
      
      const latestButcherData = butchers.find(b => b.id === butcher.id);
      
      // Use direct menu if available, otherwise fallback to butcher data
      const fullMenu = directMenu.length > 0 ? directMenu : (latestButcherData?.menu || butcher.menu || []);
      
      if (fullMenu.length === 0) {
        setMenu([]);
        return;
      }
      
      // Always filter from the full menu, not from already filtered menu
      if (isMixed) {
        const filteredMenu = fullMenu.filter(cat => {
          const categoryType = getItemTypeFromCategory(cat.name);
          const shouldInclude = activeTab === 'meat' 
            ? categoryType === 'meat' 
            : categoryType === 'fish';
          return shouldInclude;
        });
        setMenu(filteredMenu);
      } else {
        setMenu(fullMenu);
      }
    }).catch(error => {
      console.error('[Menu] Error loading menu:', error);
      setMenu([]);
    });
  }, [butcher?.id, refreshButcherData, activeTab]);

  // Save menu to sessionStorage whenever it changes (for persistence across refresh)
  useEffect(() => {
    if (!butcher || menu.length === 0 || typeof window === 'undefined') {
      return;
    }
    
    const storageKey = `menu-data-${butcher.id}`;
    const isMixed = isMixedButcher(butcher.id);
    
    // For mixed butchers, we need to save the full menu (both meat and fish)
    // So we need to merge current tab's menu with the other tab's saved menu
    if (isMixed) {
      // Get the full saved menu if it exists
      const savedMenuData = sessionStorage.getItem(storageKey);
      let fullMenu: MenuCategory[] = [];
      
      if (savedMenuData) {
        try {
          fullMenu = JSON.parse(savedMenuData) as MenuCategory[];
        } catch (error) {
          // If parsing fails, start fresh
          fullMenu = [];
        }
      }
      
      // Remove categories from the current tab type, then add current menu
      const currentTabType = activeTab === 'meat' ? 'meat' : 'fish';
      fullMenu = fullMenu.filter(cat => {
        const categoryType = getItemTypeFromCategory(cat.name);
        return categoryType !== currentTabType;
      });
      
      // Add current menu (already filtered by activeTab) and deduplicate by category ID
      const mergedMenu = [...fullMenu, ...menu];
      // Deduplicate categories by ID to prevent duplicate keys
      const uniqueMenu = mergedMenu.reduce((acc, cat) => {
        const existingIndex = acc.findIndex(c => c.id === cat.id);
        if (existingIndex >= 0) {
          // Replace existing category with new one (in case it was updated)
          acc[existingIndex] = cat;
        } else {
          acc.push(cat);
        }
        return acc;
      }, [] as MenuCategory[]);
      fullMenu = uniqueMenu;
      
      sessionStorage.setItem(storageKey, JSON.stringify(fullMenu));
    } else {
      // For non-mixed butchers, just save the current menu
      sessionStorage.setItem(storageKey, JSON.stringify(menu));
    }
  }, [menu, butcher?.id, activeTab]);

  if (!butcher) return null;

  // Get butcher type
  const butcherType = getButcherType(butcher.id);
  const isMixed = isMixedButcher(butcher.id);
  
  // Filter categories based on active tab
  // For mixed butchers: menu state is already filtered by tab, but add safety check
  // For meat/fish butchers: show all categories (but still use tabs for consistency)
  const baseVisibleMenu = menu.filter(cat => {
  // Base visibility rules (hide Mutton for 'usaj')
    if (butcher.id === 'usaj' && cat.name.toLowerCase() === 'mutton') {
      return false;
    }
    
    // Safety check for mixed butchers: ensure we only show categories matching the active tab
    if (isMixed) {
      const categoryType = getItemTypeFromCategory(cat.name);
      const shouldShow = activeTab === 'meat' 
        ? categoryType === 'meat' 
        : categoryType === 'fish';
      if (!shouldShow) {
        // This shouldn't happen if filtering is working correctly, but add safety check
        return false;
      }
    }
    
    // For meat/fish butchers, show all categories
    return true;
  });
  
  // Helper function to extract searchable names from item name
  const getSearchableNames = (itemName: string): string[] => {
    const names: string[] = [];
    const lowerName = itemName.toLowerCase();
    
    // If item name has three-language format (Manglish - English - Malayalam)
    if (itemName.includes(' - ') && itemName.split(' - ').length >= 3) {
      const parts = itemName.split(' - ');
      // Add Manglish name (first part)
      names.push(parts[0].trim().toLowerCase());
      // Add English name (second part)
      names.push(parts[1].trim().toLowerCase());
      // Add full name
      names.push(lowerName);
    } else {
      // Single name - add as is
      names.push(lowerName);
    }
    
    return names;
  };
  
  // Apply search filter for all butchers
  const filteredMenu: MenuCategory[] = (searchQuery.trim().length > 0)
    ? baseVisibleMenu
        .map(cat => ({
          ...cat,
          items: cat.items.filter(item => {
            const searchableNames = getSearchableNames(item.name);
            const query = searchQuery.toLowerCase();
            return searchableNames.some(name => name.includes(query));
          })
        }))
        .filter(cat => cat.items.length > 0)
    : baseVisibleMenu;

  const handleItemUpdate = (categoryId: string, itemId: string, updatedItem: Partial<MenuItem>) => {
    setMenu(prevMenu => 
      prevMenu.map(category => {
        if (category.id === categoryId) {
          return {
            ...category,
            items: category.items.map(item =>
              item.id === itemId ? { ...item, ...updatedItem } : item
            )
          }
        }
        return category;
      })
    )
  }

  const handleRemoveSize = (categoryId: string, itemId: string, sizeId: string) => {
     setMenu(prevMenu => 
      prevMenu.map(category => {
        if (category.id === categoryId) {
          return {
            ...category,
            items: category.items.map(item => {
              if (item.id === itemId) {
                // Ensure at least one size always exists
                if (item.sizes.length <= 1) {
                  toast({ variant: "destructive", title: "Cannot remove last size variant." });
                  return item;
                }
                return { ...item, sizes: item.sizes.filter(s => s.id !== sizeId) };
              }
              return item;
            })
          }
        }
        return category;
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    
    setIsLoading(true);
    try {
      // For mixed butchers, save only the active tab's categories
      const isMixed = isMixedButcher(butcher.id);
      const menuToSave = isMixed 
        ? menu.filter(cat => {
            const categoryType = getItemTypeFromCategory(cat.name);
            if (activeTab === 'meat') {
              return categoryType === 'meat';
            } else {
              return categoryType === 'fish';
            }
          })
        : menu;
      
      await saveMenuToSheet(butcher.id, menuToSave);
      setIsDataFromSheet(false); // Reset flag after saving
      toast({
        title: "Menu Updated",
        description: isMixed ? `${activeTab === 'meat' ? 'Meat' : 'Fish'} menu has been successfully saved.` : "Menu has been successfully saved.",
      });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not save the menu.",
        });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadFromSheet = async () => {
    if (!butcher) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get the full menu for this butcher from fresh mock data
      const fullMenu = freshButchers.find(b => b.id === butcher.id)?.menu || [];
      
      if (fullMenu.length === 0) {
        toast({
          variant: "destructive",
          title: "No Menu Found",
          description: "No menu structure found for this butcher.",
        });
        return;
      }
      
      // Filter to active tab categories only
      const isMixed = isMixedButcher(butcher.id);
      const tabMenu = isMixed 
        ? fullMenu.filter(cat => {
            const categoryType = getItemTypeFromCategory(cat.name);
            if (activeTab === 'meat') {
              return categoryType === 'meat';
            } else {
              return categoryType === 'fish';
            }
          })
        : fullMenu;
      
      // Merge with sheet data (only for active tab)
      // For mixed butchers, pass the active tab to help determine the correct sheet tab
      const mergedMenu = await mergeMenuFromSheet(butcher.id, tabMenu, isMixed ? activeTab : undefined);
      
      // For mixed butchers, replace the entire menu with merged categories (already filtered by tab)
      // For regular butchers, update existing categories
      let finalMenu: MenuCategory[];
      if (isMixed) {
        finalMenu = mergedMenu;
      setMenu(mergedMenu);
      } else {
        finalMenu = (() => {
          const updatedMenu = [...menu];
          mergedMenu.forEach(mergedCat => {
            const index = updatedMenu.findIndex(cat => cat.id === mergedCat.id);
            if (index >= 0) {
              updatedMenu[index] = mergedCat;
            } else {
              updatedMenu.push(mergedCat);
            }
          });
          return updatedMenu;
        })();
        setMenu(finalMenu);
      }
      
      // Update sessionStorage with the loaded data
      if (typeof window !== 'undefined') {
        const storageKey = `menu-data-${butcher.id}`;
        if (isMixed) {
          // For mixed butchers, merge with other tab's data
          const savedMenuData = sessionStorage.getItem(storageKey);
          let fullMenu: MenuCategory[] = [];
          if (savedMenuData) {
            try {
              fullMenu = JSON.parse(savedMenuData) as MenuCategory[];
            } catch (error) {
              fullMenu = [];
            }
          }
            const currentTabType = activeTab === 'meat' ? 'meat' : 'fish';
            fullMenu = fullMenu.filter(cat => {
              const categoryType = getItemTypeFromCategory(cat.name);
              return categoryType !== currentTabType;
            });
            const mergedMenu = [...fullMenu, ...finalMenu];
            // Deduplicate categories by ID to prevent duplicate keys
            const uniqueMenu = mergedMenu.reduce((acc, cat) => {
              const existingIndex = acc.findIndex(c => c.id === cat.id);
              if (existingIndex >= 0) {
                acc[existingIndex] = cat;
              } else {
                acc.push(cat);
              }
              return acc;
            }, [] as MenuCategory[]);
            sessionStorage.setItem(storageKey, JSON.stringify(uniqueMenu));
        } else {
          sessionStorage.setItem(storageKey, JSON.stringify(finalMenu));
        }
      }
      
      setIsDataFromSheet(true); // Mark as loaded from sheet
      
      toast({
        title: "Menu Loaded",
        description: isMixed ? `Menu loaded for ${activeTab === 'meat' ? 'Meat' : 'Fish'}tab.` : "Menu loaded.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Load Failed",
        description: "Could not load menu.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToMockData = async () => {
    if (!butcher) return;
    
    setIsLoading(true);
    try {
      // Load fresh mock data
      const { freshButchers: butchers } = await import('../../../lib/butcherConfig');
      const latestButcherData = butchers.find(b => b.id === butcher.id);
      
      if (latestButcherData) {
        // Filter to active tab categories only for mixed butchers
        const isMixed = isMixedButcher(butcher.id);
        const fullMenu = latestButcherData.menu;
        const tabMenu = isMixed 
          ? fullMenu.filter(cat => {
              const categoryType = getItemTypeFromCategory(cat.name);
              if (activeTab === 'meat') {
                return categoryType === 'meat';
              } else {
                return categoryType === 'fish';
              }
            })
          : fullMenu;
        
        // For mixed butchers, replace the entire menu with filtered categories
        // For regular butchers, update existing categories
        let finalMenu: MenuCategory[];
        if (isMixed) {
          finalMenu = tabMenu;
          setMenu(tabMenu);
        } else {
          finalMenu = (() => {
            const updatedMenu = [...menu];
            tabMenu.forEach(tabCat => {
              const index = updatedMenu.findIndex(cat => cat.id === tabCat.id);
              if (index >= 0) {
                updatedMenu[index] = tabCat;
              } else {
                updatedMenu.push(tabCat);
              }
            });
            return updatedMenu;
          })();
          setMenu(finalMenu);
        }
        
        // Update sessionStorage with the reset data
        if (typeof window !== 'undefined') {
          const storageKey = `menu-data-${butcher.id}`;
          if (isMixed) {
            // For mixed butchers, merge with other tab's data
            const savedMenuData = sessionStorage.getItem(storageKey);
            let fullMenu: MenuCategory[] = [];
            if (savedMenuData) {
              try {
                fullMenu = JSON.parse(savedMenuData) as MenuCategory[];
              } catch (error) {
                fullMenu = [];
              }
            }
            const currentTabType = activeTab === 'meat' ? 'meat' : 'fish';
            fullMenu = fullMenu.filter(cat => {
              const categoryType = getItemTypeFromCategory(cat.name);
              return categoryType !== currentTabType;
            });
            const mergedMenu = [...fullMenu, ...finalMenu];
            // Deduplicate categories by ID to prevent duplicate keys
            const uniqueMenu = mergedMenu.reduce((acc, cat) => {
              const existingIndex = acc.findIndex(c => c.id === cat.id);
              if (existingIndex >= 0) {
                acc[existingIndex] = cat;
              } else {
                acc.push(cat);
              }
              return acc;
            }, [] as MenuCategory[]);
            sessionStorage.setItem(storageKey, JSON.stringify(uniqueMenu));
          } else {
            sessionStorage.setItem(storageKey, JSON.stringify(finalMenu));
          }
        }
        
        setIsDataFromSheet(false); // Reset to mock data
        toast({
          title: "Reset to default",
          description: isMixed ? `Menu reset for ${activeTab === 'meat' ? 'Meat' : 'Fish'} tab.` : "Menu reset to mock data.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: "Could not reset to default.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {/* ✅ FIX: Responsive header matching order page */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Menu Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Update item prices and availability for your shop.</p>
          {isDataFromSheet && (
            <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-amber-600 dark:text-amber-400">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              Data loaded from Google Sheet
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLoadFromSheet}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Loader2 className="h-4 w-4" />}
            Load Previous Menu
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetToMockData}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reset to Mock Data
          </Button>
        </div>
      </div>

      {/* Tab Selection - Only show for mixed butchers */}
      {isMixed && (
        <div className="sticky top-0 z-10 bg-background border-b pb-2 mb-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'meat' | 'fish')} className="w-full">
            <TabsList className="w-full max-w-full flex sm:grid sm:grid-cols-2 gap-1 sm:gap-2 p-1 sm:p-1 h-auto sm:h-10 px-1 sm:px-1">
              <TabsTrigger value="meat" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-1 sm:flex-none">
                <span>Meat</span>
              </TabsTrigger>
              <TabsTrigger value="fish" className="flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 flex-1 sm:flex-none">
                <span>Fish</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <Label htmlFor="menu-search" className="text-xs sm:text-sm">Search items</Label>
                <Input
                  id="menu-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Manglish or English name..."
                  className="mt-2 text-sm sm:text-base"
                />
              </div>
            </div>
          </CardContent>
        </Card>

      
      <form onSubmit={handleSubmit}>
        <Card>
          {/* ✅ FIX: Responsive padding for menu card */}
          <CardContent className="p-4 sm:p-6">
            {filteredMenu.length === 0 ? (
              <div className="text-sm text-muted-foreground">No items found.</div>
            ) : (
              <Accordion type="multiple" defaultValue={filteredMenu.map(cat => cat.id)} className="w-full">
                {filteredMenu.map((category, index) => (
                  <AccordionItem value={category.id} key={`${category.id}-${index}`}>
                    <AccordionTrigger className="text-lg sm:text-xl font-semibold">{category.name}</AccordionTrigger>
                    <AccordionContent>
                      {/* ✅ FIX: Responsive spacing for menu items */}
                      <div className="space-y-4 sm:space-y-6 pt-2 sm:pt-4">
                        {category.items.map(item => (
                          <MenuItemEditor 
                            key={item.id} 
                            item={item} 
                            onUpdate={(updatedItem) => handleItemUpdate(category.id, item.id, updatedItem)}
                            onRemoveSize={(sizeId) => handleRemoveSize(category.id, item.id, sizeId)}
                            butcherId={butcher.id}
                            categoryName={category.name}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Saving..." : isMixed ? `Save ${activeTab === 'meat' ? 'Meat' : 'Fish'} Menu` : "Save Menu"}
          </Button>
        </div>
      </form>
    </div>
  )
}
