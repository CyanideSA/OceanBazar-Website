export type Locale = 'en' | 'bn';
export type UserType = 'retail' | 'wholesale';
export type OBTier = 'Bronze' | 'Silver' | 'Gold';
export type ProductStatus = 'active' | 'draft' | 'archived';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type PaymentMethod = 'cod' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'sslcommerz' | 'installment';

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  userType: UserType;
  accountStatus: 'active' | 'suspended' | 'pending' | 'pending_verification';
  emailVerified: boolean;
  preferredLang: Locale;
  profileImage: string | null;
  lifetimeSpend: number;
}

export interface ProductPricing {
  customerType: UserType;
  price: number;
  compareAt: number | null;
  tier1MinQty: number | null;
  tier1Discount: number | null;
  tier2MinQty: number | null;
  tier2Discount: number | null;
  tier3MinQty: number | null;
  tier3Discount: number | null;
  tierBands?: Array<{
    minQty: number;
    maxQty?: number | null;
    discountPct: number;
    price?: number | null;
  }> | null;
}

export interface ProductImage {
  id: number;
  productId?: string;
  url: string;
  altEn: string | null;
  altBn: string | null;
  sortOrder: number;
  mediaType: 'image' | 'video';
  isPrimary: boolean;
  colorKey?: string | null;
}

export interface Category {
  id: string;
  nameEn: string;
  nameBn: string;
  name?: string;
  slug?: string;
  parentId: string | null;
  icon: string | null;
  imageUrl?: string | null;
  isLeaf?: boolean;
  count?: number;
  children?: Category[];
}

export interface Product {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  brand: string | null;
  sku: string | null;
  /** Storefront badges / collections (from BFF formatProduct). */
  isFeatured?: boolean;
  isBestRated?: boolean;
  isBestSeller?: boolean;
  /** Set when product is shown in an active flash deal (storefront). */
  flashDeal?: boolean;
  flashFreeDelivery?: boolean;
  flashSaleId?: string;
  flashAvailable?: number;
  status: ProductStatus;
  moq: number;
  stock: number;
  tags: string[];
  trustBadges?: Array<{
    id: number;
    slug: string;
    nameEn: string;
    nameBn: string;
    icon?: string;
    description?: string;
  }>;
  primaryImage: string | null;
  images: ProductImage[];
  retailPrice: number | null;
  wholesalePrice: number | null;
  pricing: { retail: ProductPricing | null; wholesale: ProductPricing | null };
  price?: number | null;
  comparePrice?: number | null;
  stockQty?: number | null;
  specifications?: Record<string, string> | string | null;
  ratingAvg?: number | null;
  reviewCount?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  priceOverride: number | null;
  attributes: Record<string, string>;
}

export interface ProductReviewItem {
  id?: string;
  imageUrls?: string[];
  authorName: string;
  authorAvatar?: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  status?: string;
  pending?: boolean;
  verifiedPurchase?: boolean;
}

export interface ProductBanner {
  id: number;
  imageUrl: string;
  linkUrl?: string | null;
  title?: string | null;
  sortOrder: number;
}

/** Full product payload from GET /products/:id (extends list product) */
export type ProductDetail = Product & {
  sku?: string | null;
  weight?: number | null;
  weightUnit?: string | null;
  category?: { id: string; nameEn: string; nameBn: string; icon: string | null } | null;
  variants?: ProductVariant[];
  orderCount?: number;
  /** Raw attribute key→value pairs from product_attributes table */
  attributes?: Record<string, string> | null;
  /** Merged specifications + attributesExtra + weight/sku */
  specifications?: Record<string, string> | null;
  ratingAvg?: number | null;
  reviewCount?: number;
  ratingCount?: number;
  brandLogoUrl?: string | null;
  popularityRank?: number | null;
  popularityLabel?: string | null;
  reviews?: ProductReviewItem[];
  /** Full image objects with colorKey for filtering */
  richImages?: ProductImage[];
  /** If true, this product has free shipping (no shipping charge) */
  hasFreeShipping?: boolean;
  /** Product banners */
  banners?: ProductBanner[];
};

export interface CartItem {
  id: number;
  productId: string;
  variantId: string | null;
  /** e.g. "Color: silver · Style: matte" */
  variantLabel: string | null;
  title: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountPct: number;
  tierApplied: number;
  stock: number | null;
  moq: number;
  retailMaxQty: number | null;
}

export interface CartSummary {
  cartId: number;
  items: CartItem[];
  retailQuantityOrder?: boolean;
  subtotal: number;
  discount: number;
  gst: number;
  shippingFee: number;
  serviceFee: number;
  obDiscount: number;
  total: number;
  codAllowed: boolean;
  installmentAllowed: boolean;
  itemCount: number;
}

export type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'refunded';

export type ShipmentStatus =
  | 'pending'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned';

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  customerType: UserType;
  subtotal: number;
  discount: number;
  gst: number;
  shippingFee: number;
  serviceFee: number;
  obPointsUsed: number;
  obDiscount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  trackingNumber: string | null;
  createdAt: string;
}

export interface OrderLineItem {
  id: number;
  productId: string;
  variantId: string | null;
  variantLabel?: string | null;
  productTitle: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  discountPct: number;
}

export interface OrderTimelineEntry {
  id: number;
  orderId: string;
  status: string;
  note: string | null;
  actorType: string;
  actorId: string | null;
  createdAt: string;
}

export interface OrderShipment {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  estimatedDelivery: string | null;
  events: unknown;
  createdAt: string;
  updatedAt: string;
}

/** Full order from GET /api/orders/:id */
export interface OrderDetail extends Order {
  items: OrderLineItem[];
  timeline: OrderTimelineEntry[];
  shipments: OrderShipment[];
  shippingAddress: SavedAddress | null;
  notes: string | null;
  updatedAt: string;
}

export interface OBPointsInfo {
  balance: number;
  tier: OBTier;
  lifetimeSpend: number;
  options: Array<{
    points: number;
    bdtValue: number;
    canRedeem: boolean;
  }>;
}

export interface SavedAddress {
  id: number;
  userId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  district: string;
  postalCode: string | null;
  pathaoCityId?: number | null;
  pathaoZoneId?: number | null;
  pathaoAreaId?: number | null;
  pathaoCityName?: string | null;
  pathaoZoneName?: string | null;
  pathaoAreaName?: string | null;
  isDefault: boolean;
}

export interface Ticket {
  id: string;
  userId: string;
  orderId: string | null;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'payment' | 'delivery' | 'product' | 'other';
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: number;
  ticketId: string;
  senderType: 'customer' | 'admin';
  senderId: string;
  message: string;
  attachments: string[];
  createdAt: string;
}
