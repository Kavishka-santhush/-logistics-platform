// Shared domain types mirroring the Prisma models (subset used by the UI).
// Server returns Prisma JSON with Decimal fields serialized as strings.

export type Role =
  | 'SUPER_ADMIN' | 'ORG_ADMIN' | 'OPS_MANAGER' | 'DISPATCHER' | 'WAREHOUSE_MANAGER'
  | 'COMPLIANCE_OFFICER' | 'FINANCE_MANAGER' | 'DRIVER' | 'CUSTOMER';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';
  organizationId?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  currency: string;
  timezone: string;
  distanceUnit: 'KM' | 'MILES';
  weightUnit: 'KG' | 'LB';
  speedLimitKmh: number;
  subscriptionTier: 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';
  subscriptionStatus: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  isActive: boolean;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  city?: string | null;
  capacity?: number | null;
  isActive: boolean;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  vin?: string | null;
  make: string;
  model: string;
  year: number;
  type: string;
  status: 'AVAILABLE' | 'ON_DELIVERY' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE' | 'RETIRED';
  weightCapacityKg: string;
  volumeCapacityM3: string;
  fuelType: string;
  odometerKm: string;
  isAvailable: boolean;
  assignedDriverId?: string | null;
  assignedDriver?: Driver | null;
  branchId?: string | null;
  currentBookValue?: string | null;
  telematics?: { speed?: number; engineOn?: boolean; lastUpdate?: string } | null;
  createdAt: string;
}

export interface Driver {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  email?: string | null;
  status: 'AVAILABLE' | 'ON_DELIVERY' | 'OFF_DUTY' | 'ON_LEAVE' | 'SUSPENDED';
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null;
  ratingAvg: string;
  ratingCount: number;
  performanceScore: string;
  onTimeRate?: string | null;
  violationCount: number;
  assignedVehicle?: Vehicle | null;
}

export type OrderStatus =
  | 'DRAFT' | 'CONFIRMED' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED' | 'CANCELLED';

export interface Order {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  type: string;
  priority: string;
  status: OrderStatus;
  pickupCity?: string | null;
  deliveryCity?: string | null;
  deliveryAddressLine: string;
  totalWeightKg: string;
  distanceKm?: string | null;
  chargeAmount?: string | null;
  currency: string;
  isCOD: boolean;
  codAmount: string;
  promisedAt?: string | null;
  deliveredAt?: string | null;
  isLate: boolean;
  customerId: string;
  customer?: Customer | null;
  assignedDriverId?: string | null;
  assignedDriver?: Driver | null;
  assignedVehicle?: Vehicle | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  tier: 'STANDARD' | 'SILVER' | 'GOLD' | 'PLATINUM';
  creditLimit?: string | null;
  paymentTerms?: string | null;
  slaHours?: number | null;
  ratingAvg: string;
}

export interface Invoice {
  id: string;
  number: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  customer?: Customer | null;
}

export interface TrackingPoint {
  id: string;
  vehicleId: string;
  latitude: string;
  longitude: string;
  speedKmh?: string | null;
  heading?: string | null;
  recordedAt: string;
}

export interface LiveVehicle {
  vehicleId: string;
  plateNumber: string;
  driverName?: string | null;
  speedKmh: number;
  engineOn: boolean;
  latitude: number;
  longitude: number;
  orderId?: string | null;
  recordedAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  payload?: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

export interface AnalyticsOverview {
  ordersTotal: number;
  activeOrders: number;
  deliveredToday: number;
  failedOrders: number;
  onTimeRate: number;
  fleetUtilization: number;
  vehiclesAvailable: number;
  vehiclesTotal: number;
  driversActive: number;
  revenue: number;
  revenueOutstanding: number;
  currency: string;
}

export interface ComplianceDoc {
  id: string;
  type: string;
  title: string;
  expiryDate?: string | null;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  fileUrl: string;
  vehicleId?: string | null;
  driverId?: string | null;
}
