export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface Address {
  id: string;
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string;
  is_default: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  addresses?: Address[];
}

export interface UserProfileUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  pincode?: string;
  current_password?: string;
  new_password?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
}

export interface ProductVariantInfo {
  id: string;
  sku: string;
  price: number;
  unit: string;
  quantity_available: number;
}

export interface Product {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  unit: string;
  image_url?: string | null;
  is_active: boolean;
  is_returnable: boolean;
  tax_rate?: number;
  quantity_available: number;
  parent_id?: string | null;
  variants?: ProductVariantInfo[];
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  image_url?: string | null;
}

export interface CartResponse {
  id: string;
  items: CartItem[];
  subtotal: number;
}

export interface PickupSlot {
  id: string;
  store_id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  slots_remaining: number;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'RETURNED'
  | 'EXCHANGED';

export type FulfillmentType = 'PICKUP' | 'DELIVERY';

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit_price?: number;
  unit_price_at_order?: number;
  quantity: number;
  line_total: number;
  image_url?: string | null;
  is_returnable?: boolean;
}

export interface OrderStatusLog {
  id: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  changed_by_name?: string | null;
  note?: string | null;
  created_at: string;
}

export interface DeliveryAddress {
  id: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark?: string | null;
}

export interface OrderResponse {
  id: string;
  order_number: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  pickup_slot_id?: string | null;
  pickup_slot?: PickupSlot | null;
  subtotal: number;
  tax: number;
  total: number;
  created_at: string;
  items: OrderItem[];
  order_status_history: OrderStatusLog[];
  delivery_note?: string | null;
  user?: { id: string; name: string; email: string; phone?: string | null } | null;
  delivery_address?: DeliveryAddress | null;
  delivery_address_id?: string | null;
}

export type ReturnType = 'RETURN' | 'EXCHANGE';
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface ReturnRequestResponse {
  id: string;
  order_id: string;
  order_item_id: string;
  product_name: string;
  type: ReturnType;
  status: ReturnStatus;
  requested_qty: number;
  exchange_for_product_id?: string | null;
  exchange_for_product_name?: string | null;
  reason: string;
  resolved_by_name?: string | null;
  resolution_note?: string | null;
  created_at: string;
}

export interface InventoryOverviewResponse {
  id: string;
  product_id: string;
  product_name: string;
  store_id: string;
  store_name: string;
  quantity_available: number;
  quantity_reserved: number;
  reorder_threshold: number;
}

export interface LowStockItemResponse {
  product_id: string;
  product_name: string;
  sku: string;
  store_name: string;
  quantity_available: number;
  reorder_threshold: number;
}

export interface AuditLogResponse {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

