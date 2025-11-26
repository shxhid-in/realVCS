
export interface MenuItemSize {
  id: string;
  size: 'default' | 'small' | 'medium' | 'big';
  price: number;
  minWeight?: number;
  maxWeight?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  unit: 'kg' | 'nos';
  available: boolean;
  sizes: MenuItemSize[];
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface Butcher {
  id: 'usaj' | 'usaj_mutton' | 'pkd' | 'kak' | 'ka_sons' | 'alif' | 'test_meat' | 'test_fish';
  name: string;
  password: string;
  menu: MenuCategory[];
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'g' | 'nos';
  cutType?: string;
  size?: string;
  category?: string; // Add category information for better matching
}

export interface Order {
  id: string;
  customerName: string;
  items: OrderItem[];
  status: 'new' | 'preparing' | 'prepared' | 'completed' | 'ready to pick up' | 'rejected';
  orderTime: Date;
  preparationStartTime?: Date;
  preparationEndTime?: Date;
  rejectionReason?: string;
  pickedWeight?: number;
  revenue?: number;
  address?: string;
  completionTime?: number; // Completion time in minutes
  itemWeights?: {[itemName: string]: string}; // Individual item preparation weights (for fish butchers)
  itemQuantities?: {[itemName: string]: string}; // Individual item quantities (for meat butchers)
  itemRevenues?: {[itemName: string]: number}; // Individual item revenues for butcher
  butcherId?: string; // ID of the butcher assigned to this order
  butcherName?: string; // Name of the butcher assigned to this order
  finalWeight?: number; // Final weight after preparation
  _source?: 'central-api' | 'sheet'; // Source of the order
  _receivedAt?: Date; // When order was received
}

export interface CommissionRate {
  butcherId: string;
  category: string;
  rate: number; // Commission rate as decimal (e.g., 0.07 for 7%)
}

export interface MarkupRate {
  butcherId: string;
  category: string;
  rate: number; // Markup rate as decimal (e.g., 0.05 for 5%)
}

export interface ButcherRates {
  butcherId: string;
  butcherName: string;
  commissionRates: CommissionRate[];
  markupRates: MarkupRate[];
}
