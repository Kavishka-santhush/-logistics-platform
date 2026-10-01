// Domain types mirroring the Prisma models the driver app consumes.
// Server serializes Prisma Decimals as strings.

export type Role =
  | 'SUPER_ADMIN' | 'ORG_ADMIN' | 'OPS_MANAGER' | 'DISPATCHER' | 'WAREHOUSE_MANAGER'
  | 'COMPLIANCE_OFFICER' | 'FINANCE_MANAGER' | 'DRIVER' | 'CUSTOMER';

export interface DriverProfile {
  id: string;
  name: string;
  employeeId: string;
  status: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
}

export interface Me {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: Role;
  organizationId?: string | null;
  organization?: Organization | null;
  driverProfile?: DriverProfile | null;
}

export type OrderStatus =
  | 'DRAFT' | 'CONFIRMED' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED' | 'CANCELLED';

export interface Task {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  type: string;
  priority: string;
  status: OrderStatus;
  pickupCity?: string | null;
  deliveryCity?: string | null;
  deliveryAddressLine: string;
  contactName?: string | null;
  contactPhone?: string | null;
  totalWeightKg: string;
  chargeAmount?: string | null;
  codAmount: string;
  currency: string;
  isCOD: boolean;
  promisedAt?: string | null;
  customer?: { companyName: string } | null;
  packages?: { id: string; barcode: string; type: string }[];
  proofs?: { id: string; fileUrl: string; capturedAt: string; capturedName?: string | null; signatureUrl?: string | null }[];
}

/** Full order payload returned by GET /orders/:id (includes relations). */
export interface OrderDetail extends Task {
  pickupAddressLine?: string;
  pickupContactName?: string | null;
  pickupContactPhone?: string | null;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  deliveryLatitude?: string | number | null;
  deliveryLongitude?: string | number | null;
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
  scheduledDeliveryAt?: string | null;
  distanceKm?: string | number | null;
  totalDeclaredValue?: string | null;
  specialInstructions?: string | null;
  failedReason?: string | null;
  failedNote?: string | null;
  deliveredAt?: string | null;
  pickedUpAt?: string | null;
  assignedDriver?: { id: string; name: string; phone: string } | null;
  assignedVehicle?: { id: string; plateNumber: string } | null;
  events?: { id: string; status: string; note?: string | null; createdAt: string }[];
}

export interface DriverFull {
  id: string;
  name: string;
  employeeId: string;
  phone: string;
  status: string;
  todayDrivingMinutes: number;
  hoursLimitDaily: number | string;
  onTimeRate: number | string;
  successRate: number | string;
  ratingAvg: number | string;
  performanceScore: number | string;
  licenseExpiryDate?: string | null;
  branch?: { id: string; name: string } | null;
  vehicles?: { id: string; plateNumber: string; type: string }[];
}

export interface DriverMessageFull {
  id: string;
  driverId: string;
  body: string;
  isFromDriver: boolean;
  orderId?: string | null;
  createdAt: string;
}

export interface UploadResult {
  url: string;
  absoluteUrl: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface PerformanceSummary {
  onTimeRate: number;
  successRate: number;
  avgRating?: number | null;
  violations?: number;
  score: number;
  updatedAt?: string;
}

export interface GpsPoint {
  latitude: number;
  longitude: number;
  speedKmh?: number;
  heading?: number;
  recordedAt?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'DRIVER' | 'DISPATCH';
  body: string;
  createdAt: string;
}
