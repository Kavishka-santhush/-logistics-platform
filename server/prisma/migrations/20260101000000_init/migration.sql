-- ============================================================================
-- Init migration — Logistics & Fleet Management Platform
-- Generated to mirror prisma/schema.prisma
-- PostgreSQL · pg_trgm extension · multi-organization SaaS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN','ORG_ADMIN','OPS_MANAGER','DISPATCHER','WAREHOUSE_MANAGER','COMPLIANCE_OFFICER','FINANCE_MANAGER','DRIVER','CUSTOMER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE','INVITED','SUSPENDED','DISABLED');
CREATE TYPE "VehicleType" AS ENUM ('MOTORCYCLE','CAR','VAN','PICKUP','SMALL_TRUCK','MEDIUM_TRUCK','LARGE_TRUCK','CONTAINER_TRUCK','REFRIGERATED','TANKER','FLATBED');
CREATE TYPE "FuelType" AS ENUM ('PETROL','DIESEL','CNG','ELECTRIC','HYBRID');
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE','ON_DELIVERY','UNDER_MAINTENANCE','OUT_OF_SERVICE','RETIRED');
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE','REDUCING_BALANCE','NONE');
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE','ON_DELIVERY','OFF_DUTY','ON_LEAVE','SUSPENDED');
CREATE TYPE "ContractType" AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','FREELANCE');
CREATE TYPE "OrderType" AS ENUM ('STANDARD','EXPRESS','SAME_DAY','SCHEDULED','RETURN','INTER_BRANCH','B2B_FREIGHT');
CREATE TYPE "PackageType" AS ENUM ('DOCUMENT','PARCEL','PALLET','CONTAINER','FRAGILE','HAZARDOUS','REFRIGERATED','OVERSIZED');
CREATE TYPE "OrderPriority" AS ENUM ('NORMAL','HIGH','URGENT','VIP');
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT','CONFIRMED','ASSIGNED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED');
CREATE TYPE "FailedReason" AS ENUM ('RECIPIENT_ABSENT','WRONG_ADDRESS','REFUSED','DAMAGED','OTHER');
CREATE TYPE "RouteStatus" AS ENUM ('PLANNED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "StopStatus" AS ENUM ('PENDING','ARRIVED','COMPLETED','FAILED','SKIPPED');
CREATE TYPE "DispatchMode" AS ENUM ('SINGLE_ORDER','FULL_ROUTE','BULK','EMERGENCY');
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED','CANCELLED');
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING','RECEIVED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED');
CREATE TYPE "StockMovementType" AS ENUM ('INBOUND','OUTBOUND','TRANSFER','ADJUSTMENT','RETURN','CROSS_DOCK');
CREATE TYPE "MaintenanceType" AS ENUM ('OIL_CHANGE','TIRE_ROTATION','BRAKE_SERVICE','ENGINE_SERVICE','GENERAL_INSPECTION','BODY_REPAIR','TYRE_REPLACEMENT','BATTERY','AC_SERVICE','CUSTOM');
CREATE TYPE "MaintenanceTrigger" AS ENUM ('KM','ENGINE_HOURS','CALENDAR');
CREATE TYPE "MaintenanceStatus" AS ENUM ('PLANNED','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','OVERDUE');
CREATE TYPE "DocumentType" AS ENUM ('VEHICLE_REGISTRATION','INSURANCE','ROADWORTHINESS','EMISSION_TEST','DRIVER_LICENSE','MEDICAL_CERTIFICATE','BACKGROUND_CHECK','TRAINING_CERTIFICATE','CUSTOMS_PERMIT','HAZMAT_LICENSE','ID_CARD','CONTRACT','OTHER');
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_REVIEW','APPROVED','REJECTED','EXPIRED');
CREATE TYPE "CustomerTier" AS ENUM ('STANDARD','SILVER','GOLD','PLATINUM');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','SENT','PAID','PARTIALLY_PAID','OVERDUE','CANCELLED');
CREATE TYPE "LineItemType" AS ENUM ('DELIVERY_FEE','DISTANCE_CHARGE','WEIGHT_CHARGE','FUEL_SURCHARGE','WAITING_TIME','ADDITIONAL_STOP','COD_FEE','INSURANCE','CUSTOM');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH','BANK_TRANSFER','CHEQUE','ONLINE','CARD');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','COMPLETED','FAILED','REFUNDED');
CREATE TYPE "NotificationType" AS ENUM ('NEW_ORDER','ASSIGNMENT','ASSIGNMENT_ACCEPTED','ASSIGNMENT_REJECTED','DELIVERY_COMPLETED','DELIVERY_FAILED','MAINTENANCE_DUE','DOCUMENT_EXPIRY','DRIVER_SOS','GEOFENCE_BREACH','SPEED_VIOLATION','IDLE_ALERT','INVOICE_SENT','INVOICE_PAID','COMPLIANCE_ALERT','SYSTEM');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP','EMAIL','PUSH','WEB_PUSH','SMS');
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER','PROFESSIONAL','BUSINESS','ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING','ACTIVE','PAST_DUE','CANCELLED');
CREATE TYPE "PricingModel" AS ENUM ('FLAT','PER_KM','PER_KG','ZONE_BASED','VEHICLE_TYPE');
CREATE TYPE "ChecklistType" AS ENUM ('PRE_TRIP','POST_TRIP');
CREATE TYPE "IncidentType" AS ENUM ('ACCIDENT','BREAKDOWN','NEAR_MISS','THEFT','DAMAGE','OTHER');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE "LeaveStatus" AS ENUM ('REQUESTED','APPROVED','REJECTED','CANCELLED');
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL','SICK','UNPAID','EMERGENCY');
CREATE TYPE "DistanceUnit" AS ENUM ('KM','MILES');
CREATE TYPE "WeightUnit" AS ENUM ('KG','LB');
CREATE TYPE "AuditAction" AS ENUM ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','APPROVE','REJECT');

-- ─── Organizations & Auth ──────────────────────────────────────────────────────
CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "taxNumber" TEXT,
  "addressLine" TEXT,
  "city" TEXT,
  "country" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "website" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "distanceUnit" "DistanceUnit" NOT NULL DEFAULT 'KM',
  "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG',
  "workingHours" JSONB,
  "speedLimitKmh" INTEGER NOT NULL DEFAULT 90,
  "idleAlertMins" INTEGER NOT NULL DEFAULT 15,
  "operatingRegions" JSONB,
  "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'STARTER',
  "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "subscriptionId" TEXT,
  "trialEndsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "organizations_subscriptionId_key" ON "organizations"("subscriptionId");
CREATE INDEX "organizations_subscriptionTier_idx" ON "organizations"("subscriptionTier");

CREATE TABLE "subscription_plans" (
  "id" TEXT NOT NULL,
  "tier" "SubscriptionTier" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceMonthly" DECIMAL(10,2) NOT NULL,
  "priceYearly" DECIMAL(10,2) NOT NULL,
  "vehicleLimit" INTEGER NOT NULL,
  "driverLimit" INTEGER NOT NULL,
  "features" JSONB NOT NULL,
  "stripePriceIdMonthly" TEXT,
  "stripePriceIdYearly" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscription_plans_tier_key" ON "subscription_plans"("tier");

CREATE TABLE "branches" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "addressLine" TEXT,
  "city" TEXT,
  "country" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "phone" TEXT,
  "email" TEXT,
  "managerName" TEXT,
  "capacity" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branches_organizationId_code_key" ON "branches"("organizationId","code");
ALTER TABLE "branches" ADD CONSTRAINT "branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "clerkId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "phone" TEXT,
  "avatarUrl" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "language" TEXT NOT NULL DEFAULT 'en',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "lastLoginAt" TIMESTAMP(3),
  "pushToken" TEXT,
  "webPushEndpoint" TEXT,
  "passwordPin" TEXT,
  "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
  "organizationId" TEXT,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX "users_role_idx" ON "users"("role");
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Drivers ───────────────────────────────────────────────────────────────────
CREATE TABLE "drivers" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "userId" TEXT,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "photoUrl" TEXT,
  "nicOrPassport" TEXT,
  "dob" TIMESTAMP(3),
  "addressLine" TEXT,
  "city" TEXT,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "bloodGroup" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "joinDate" TIMESTAMP(3) NOT NULL,
  "contractType" "ContractType" NOT NULL DEFAULT 'FULL_TIME',
  "salary" DECIMAL(12,2),
  "allowances" JSONB,
  "deductions" JSONB,
  "licenseNumber" TEXT,
  "licenseClass" TEXT,
  "licenseIssueDate" TIMESTAMP(3),
  "licenseExpiryDate" TIMESTAMP(3),
  "licenseScanUrl" TEXT,
  "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',
  "ratingAvg" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "performanceScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "onTimeRate" DECIMAL(5,2),
  "successRate" DECIMAL(5,2),
  "fuelEfficiencyScore" DECIMAL(5,2),
  "violationCount" INTEGER NOT NULL DEFAULT 0,
  "hoursLimitDaily" DECIMAL(4,2) NOT NULL DEFAULT 10,
  "todayDrivingMinutes" INTEGER NOT NULL DEFAULT 0,
  "hosResetAt" TIMESTAMP(3),
  "isSuspended" BOOLEAN NOT NULL DEFAULT false,
  "suspensionReason" TEXT,
  "appAccessRevoked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drivers_userId_key" ON "drivers"("userId");
CREATE UNIQUE INDEX "drivers_organizationId_employeeId_key" ON "drivers"("organizationId","employeeId");
CREATE INDEX "drivers_organizationId_status_idx" ON "drivers"("organizationId","status");
CREATE INDEX "drivers_licenseExpiryDate_idx" ON "drivers"("licenseExpiryDate");
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "driver_trainings" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" TEXT,
  "certificateUrl" TEXT,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "driver_trainings_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "driver_trainings" ADD CONSTRAINT "driver_trainings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "driver_leaves" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "type" "LeaveType" NOT NULL DEFAULT 'ANNUAL',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'REQUESTED',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "driver_leaves_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "driver_leaves_driverId_startDate_idx" ON "driver_leaves"("driverId","startDate");
ALTER TABLE "driver_leaves" ADD CONSTRAINT "driver_leaves_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "driver_shifts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "shiftDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "label" TEXT,
  "branchId" TEXT,
  CONSTRAINT "driver_shifts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "driver_shifts_driverId_shiftDate_startTime_key" ON "driver_shifts"("driverId","shiftDate","startTime");
CREATE INDEX "driver_shifts_organizationId_shiftDate_idx" ON "driver_shifts"("organizationId","shiftDate");
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "driver_performance_snapshots" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "onTimeRate" DECIMAL(5,2) NOT NULL,
  "successRate" DECIMAL(5,2) NOT NULL,
  "deliveriesCompleted" INTEGER NOT NULL,
  "violations" INTEGER NOT NULL DEFAULT 0,
  "avgRating" DECIMAL(3,2) NOT NULL,
  "score" DECIMAL(5,2) NOT NULL,
  CONSTRAINT "driver_performance_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "driver_performance_snapshots_driverId_year_month_key" ON "driver_performance_snapshots"("driverId","year","month");
ALTER TABLE "driver_performance_snapshots" ADD CONSTRAINT "driver_performance_snapshots_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hours_of_service_logs" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "logDate" TIMESTAMP(3) NOT NULL,
  "drivingMinutes" INTEGER NOT NULL DEFAULT 0,
  "onDutyMinutes" INTEGER NOT NULL DEFAULT 0,
  "restMinutes" INTEGER NOT NULL DEFAULT 0,
  "violations" JSONB,
  "detail" JSONB,
  CONSTRAINT "hours_of_service_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hours_of_service_logs_driverId_logDate_key" ON "hours_of_service_logs"("driverId","logDate");
ALTER TABLE "hours_of_service_logs" ADD CONSTRAINT "hours_of_service_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Vehicles ──────────────────────────────────────────────────────────────────
CREATE TABLE "vehicles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "plateNumber" TEXT NOT NULL,
  "vin" TEXT,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "color" TEXT,
  "type" "VehicleType" NOT NULL,
  "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
  "weightCapacityKg" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "volumeCapacityM3" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "palletCapacity" INTEGER NOT NULL DEFAULT 0,
  "fuelType" "FuelType" NOT NULL DEFAULT 'DIESEL',
  "gpsDeviceId" TEXT,
  "odometerKm" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "engineHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "telematics" JSONB,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "availabilityNote" TEXT,
  "purchasePrice" DECIMAL(12,2) NOT NULL,
  "purchaseDate" TIMESTAMP(3) NOT NULL,
  "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
  "usefulLifeYears" INTEGER NOT NULL DEFAULT 10,
  "residualValuePct" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "currentBookValue" DECIMAL(12,2),
  "assignedDriverId" TEXT,
  "photos" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles"("vin");
CREATE UNIQUE INDEX "vehicles_organizationId_plateNumber_key" ON "vehicles"("organizationId","plateNumber");
CREATE INDEX "vehicles_organizationId_status_idx" ON "vehicles"("organizationId","status");
CREATE INDEX "vehicles_organizationId_isAvailable_idx" ON "vehicles"("organizationId","isAvailable");
CREATE INDEX "vehicles_gpsDeviceId_idx" ON "vehicles"("gpsDeviceId");
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "vehicle_telematics" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "speedKmh" DECIMAL(6,2) NOT NULL,
  "engineOn" BOOLEAN NOT NULL,
  "odometerKm" DECIMAL(12,2) NOT NULL,
  "fuelLevelPct" DECIMAL(5,2),
  "data" JSONB,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_telematics_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vehicle_telematics_vehicleId_recordedAt_idx" ON "vehicle_telematics"("vehicleId","recordedAt");
ALTER TABLE "vehicle_telematics" ADD CONSTRAINT "vehicle_telematics_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Customers ───────────────────────────────────────────────────────────────
CREATE TABLE "customers" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "logoUrl" TEXT,
  "billingAddressLine" TEXT,
  "billingCity" TEXT,
  "billingTaxNumber" TEXT,
  "tier" "CustomerTier" NOT NULL DEFAULT 'STANDARD',
  "creditLimit" DECIMAL(12,2),
  "paymentTerms" TEXT DEFAULT 'net30',
  "slaHours" INTEGER,
  "ratingAvg" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customers_userId_key" ON "customers"("userId");
CREATE INDEX "customers_organizationId_tier_idx" ON "customers"("organizationId","tier");
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "customer_addresses" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "addressLine" TEXT NOT NULL,
  "city" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "contactName" TEXT,
  "contactPhone" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_addresses_customerId_idx" ON "customer_addresses"("customerId");
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customer_contracts" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "rateOverride" JSONB,
  "fileUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "customer_contracts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_contracts_customerId_idx" ON "customer_contracts"("customerId");
ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sla_breaches" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderNo" TEXT NOT NULL,
  "breachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "minutesLate" INTEGER,
  CONSTRAINT "sla_breaches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sla_breaches_customerId_breachedAt_idx" ON "sla_breaches"("customerId","breachedAt");
ALTER TABLE "sla_breaches" ADD CONSTRAINT "sla_breaches_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Routes & Orders ─────────────────────────────────────────────────────────
CREATE TABLE "route_templates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "waypoints" JSONB NOT NULL,
  "distanceKm" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "route_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "route_templates_organizationId_name_key" ON "route_templates"("organizationId","name");
ALTER TABLE "route_templates" ADD CONSTRAINT "route_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "routes" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "RouteStatus" NOT NULL DEFAULT 'PLANNED',
  "waypoints" JSONB NOT NULL,
  "totalDistanceKm" DECIMAL(10,2),
  "totalDurationMin" DECIMAL(10,2),
  "plannedBy" TEXT,
  "templateId" TEXT,
  "driverId" TEXT,
  "vehicleId" TEXT,
  "isOptimized" BOOLEAN NOT NULL DEFAULT false,
  "optimizationData" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "routes_organizationId_date_idx" ON "routes"("organizationId","date");
CREATE INDEX "routes_organizationId_status_idx" ON "routes"("organizationId","status");
ALTER TABLE "routes" ADD CONSTRAINT "routes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "routes" ADD CONSTRAINT "routes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "route_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "routes" ADD CONSTRAINT "routes_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "routes" ADD CONSTRAINT "routes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "customerId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "type" "OrderType" NOT NULL DEFAULT 'STANDARD',
  "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
  "pickupAddressLine" TEXT NOT NULL,
  "pickupCity" TEXT,
  "pickupLatitude" DECIMAL(10,7),
  "pickupLongitude" DECIMAL(10,7),
  "pickupContactName" TEXT,
  "pickupContactPhone" TEXT,
  "scheduledPickupAt" TIMESTAMP(3),
  "deliveryAddressLine" TEXT NOT NULL,
  "deliveryCity" TEXT,
  "deliveryLatitude" DECIMAL(10,7),
  "deliveryLongitude" DECIMAL(10,7),
  "deliveryContactName" TEXT,
  "deliveryContactPhone" TEXT,
  "scheduledDeliveryAt" TIMESTAMP(3),
  "deliveryWindowStart" TEXT,
  "deliveryWindowEnd" TEXT,
  "totalWeightKg" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalVolumeM3" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalDeclaredValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "distanceKm" DECIMAL(10,2),
  "chargeAmount" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "isCOD" BOOLEAN NOT NULL DEFAULT false,
  "codAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "codCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "codReconciledAt" TIMESTAMP(3),
  "pickedUpAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failedReason" "FailedReason",
  "failedNote" TEXT,
  "rescheduledFromId" TEXT,
  "returnOrderId" TEXT,
  "promisedAt" TIMESTAMP(3),
  "isLate" BOOLEAN NOT NULL DEFAULT false,
  "assignedDriverId" TEXT,
  "assignedVehicleId" TEXT,
  "routeId" TEXT,
  "specialInstructions" TEXT,
  "internalNotes" TEXT,
  "customerNotes" TEXT,
  "cancellationReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "refundEligible" BOOLEAN,
  "labelUrl" TEXT,
  "labelQrUrl" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE UNIQUE INDEX "orders_trackingNumber_key" ON "orders"("trackingNumber");
CREATE INDEX "orders_organizationId_status_idx" ON "orders"("organizationId","status");
CREATE INDEX "orders_organizationId_createdAt_idx" ON "orders"("organizationId","createdAt");
CREATE INDEX "orders_customerId_status_idx" ON "orders"("customerId","status");
CREATE INDEX "orders_assignedDriverId_status_idx" ON "orders"("assignedDriverId","status");
CREATE INDEX "orders_routeId_idx" ON "orders"("routeId");
CREATE INDEX "orders_trackingNumber_idx" ON "orders"("trackingNumber");
ALTER TABLE "orders" ADD CONSTRAINT "orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "route_stops" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "StopStatus" NOT NULL DEFAULT 'PENDING',
  "addressLine" TEXT NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "windowStart" TIMESTAMP(3),
  "windowEnd" TIMESTAMP(3),
  "etaAt" TIMESTAMP(3),
  "arrivedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "distanceFromPrevKm" DECIMAL(8,2),
  "notes" TEXT,
  CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "route_stops_routeId_sequence_key" ON "route_stops"("routeId","sequence");
CREATE INDEX "route_stops_orderId_idx" ON "route_stops"("orderId");
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "packages" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "barcode" TEXT NOT NULL,
  "type" "PackageType" NOT NULL DEFAULT 'PARCEL',
  "description" TEXT,
  "weightKg" DECIMAL(10,2) NOT NULL,
  "lengthCm" DECIMAL(8,2),
  "widthCm" DECIMAL(8,2),
  "heightCm" DECIMAL(8,2),
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "declaredValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "handlingFlags" JSONB,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
  "photos" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "packages_barcode_key" ON "packages"("barcode");
CREATE INDEX "packages_orderId_idx" ON "packages"("orderId");
ALTER TABLE "packages" ADD CONSTRAINT "packages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "order_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "note" TEXT,
  "actorId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "order_events_orderId_createdAt_idx" ON "order_events"("orderId","createdAt");
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "order_notes" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'internal',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "order_notes_orderId_idx" ON "order_notes"("orderId");
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "proof_of_delivery" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "signatureUrl" TEXT,
  "photoUrls" JSONB,
  "capturedName" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "codCollected" DECIMAL(12,2),
  "metadata" JSONB,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proof_of_delivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "proof_of_delivery_orderId_idx" ON "proof_of_delivery"("orderId");
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "shipments" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
  "originWarehouseId" TEXT,
  "destinationText" TEXT,
  "currentHubId" TEXT,
  "etaAt" TIMESTAMP(3),
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shipments_orderId_key" ON "shipments"("orderId");
CREATE INDEX "shipments_status_idx" ON "shipments"("status");
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "delivery_ratings" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT,
  "driverId" TEXT,
  "reviewerId" TEXT,
  "stars" INTEGER NOT NULL,
  "punctuality" INTEGER,
  "handling" INTEGER,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_ratings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "delivery_ratings_orderId_key" ON "delivery_ratings"("orderId");
CREATE INDEX "delivery_ratings_driverId_idx" ON "delivery_ratings"("driverId");
ALTER TABLE "delivery_ratings" ADD CONSTRAINT "delivery_ratings_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_ratings" ADD CONSTRAINT "delivery_ratings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_ratings" ADD CONSTRAINT "delivery_ratings_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Dispatch ────────────────────────────────────────────────────────────────
CREATE TABLE "dispatches" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "mode" "DispatchMode" NOT NULL DEFAULT 'SINGLE_ORDER',
  "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
  "orderId" TEXT,
  "routeId" TEXT,
  "driverId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "emergency" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "rejectedReason" TEXT,
  "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "dispatches_organizationId_status_idx" ON "dispatches"("organizationId","status");
CREATE INDEX "dispatches_driverId_status_idx" ON "dispatches"("driverId","status");
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Tracking & Geofencing ───────────────────────────────────────────────────
CREATE TABLE "tracking_points" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT,
  "orderId" TEXT,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "speedKmh" DECIMAL(6,2),
  "heading" DECIMAL(5,2),
  "accuracyM" DECIMAL(8,2),
  "engineOn" BOOLEAN,
  "odometerKm" DECIMAL(12,2),
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tracking_points_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tracking_points_vehicleId_recordedAt_idx" ON "tracking_points"("vehicleId","recordedAt");
CREATE INDEX "tracking_points_organizationId_recordedAt_idx" ON "tracking_points"("organizationId","recordedAt");
CREATE INDEX "tracking_points_orderId_idx" ON "tracking_points"("orderId");
ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "geofences" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'circle',
  "centerLat" DECIMAL(10,7),
  "centerLng" DECIMAL(10,7),
  "radiusM" DECIMAL(10,2),
  "polygon" JSONB,
  "alertOn" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "geofence_alerts" (
  "id" TEXT NOT NULL,
  "geofenceId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT,
  "eventType" TEXT NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "geofence_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "geofence_alerts_vehicleId_triggeredAt_idx" ON "geofence_alerts"("vehicleId","triggeredAt");
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "geofences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Warehouse & Inventory ───────────────────────────────────────────────────
CREATE TABLE "warehouses" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "addressLine" TEXT,
  "city" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "capacityM3" DECIMAL(12,2),
  "usedM3" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "managerName" TEXT,
  "phone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warehouses_organizationId_code_key" ON "warehouses"("organizationId","code");
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "warehouse_zones" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "capacityPct" DECIMAL(5,2),
  CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "warehouse_zones_warehouseId_idx" ON "warehouse_zones"("warehouseId");
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inventory_items" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "barcode" TEXT,
  "category" TEXT,
  "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL DEFAULT 'pcs',
  "minStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maxStock" DECIMAL(12,2),
  "binLocation" TEXT,
  "zoneId" TEXT,
  "unitValue" DECIMAL(12,2),
  "weightKg" DECIMAL(10,2),
  "expiresAt" TIMESTAMP(3),
  "lastCountedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inventory_items_warehouseId_sku_key" ON "inventory_items"("warehouseId","sku");
CREATE INDEX "inventory_items_organizationId_idx" ON "inventory_items"("organizationId");
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "fromBin" TEXT,
  "toBin" TEXT,
  "operatorName" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movements_itemId_createdAt_idx" ON "stock_movements"("itemId","createdAt");
CREATE INDEX "stock_movements_warehouseId_createdAt_idx" ON "stock_movements"("warehouseId","createdAt");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "stock_adjustments" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "countedQty" DECIMAL(12,2) NOT NULL,
  "systemQty" DECIMAL(12,2) NOT NULL,
  "variance" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "adjustedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_adjustments_itemId_idx" ON "stock_adjustments"("itemId");
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inbound_shipments" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "grnNumber" TEXT NOT NULL,
  "supplierName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'expected',
  "receivedAt" TIMESTAMP(3),
  "lines" JSONB NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inbound_shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inbound_shipments_grnNumber_key" ON "inbound_shipments"("grnNumber");
ALTER TABLE "inbound_shipments" ADD CONSTRAINT "inbound_shipments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "warehouse_tasks" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "itemId" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "assignedToName" TEXT,
  "referenceId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 3,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouse_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "warehouse_tasks_warehouseId_status_idx" ON "warehouse_tasks"("warehouseId","status");
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Maintenance ─────────────────────────────────────────────────────────────
CREATE TABLE "maintenance_schedules" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "type" "MaintenanceType" NOT NULL,
  "trigger" "MaintenanceTrigger" NOT NULL,
  "kmInterval" INTEGER,
  "hoursInterval" INTEGER,
  "daysInterval" INTEGER,
  "lastDoneAt" TIMESTAMP(3),
  "lastDoneKm" DECIMAL(12,2),
  "nextDueAt" TIMESTAMP(3),
  "nextDueKm" DECIMAL(12,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "maintenance_schedules_vehicleId_idx" ON "maintenance_schedules"("vehicleId");
CREATE INDEX "maintenance_schedules_nextDueAt_idx" ON "maintenance_schedules"("nextDueAt");
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "maintenance_vendors" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "addressLine" TEXT,
  "specialties" JSONB,
  "hourlyRate" DECIMAL(10,2),
  "rating" DECIMAL(3,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "maintenance_vendors_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "maintenance_vendors" ADD CONSTRAINT "maintenance_vendors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "maintenance_work_orders" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "scheduleId" TEXT,
  "vendorId" TEXT,
  "number" TEXT NOT NULL,
  "type" "MaintenanceType" NOT NULL,
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'PLANNED',
  "description" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "downtimeHours" DECIMAL(8,2),
  "mileageAtService" DECIMAL(12,2),
  "estimatedCost" DECIMAL(12,2),
  "actualCost" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "invoiceUrl" TEXT,
  "aiPrediction" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "maintenance_work_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "maintenance_work_orders_number_key" ON "maintenance_work_orders"("number");
CREATE INDEX "maintenance_work_orders_organizationId_status_idx" ON "maintenance_work_orders"("organizationId","status");
CREATE INDEX "maintenance_work_orders_vehicleId_completedAt_idx" ON "maintenance_work_orders"("vehicleId","completedAt");
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "maintenance_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "maintenance_parts" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "partNumber" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitCost" DECIMAL(12,2),
  CONSTRAINT "maintenance_parts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "maintenance_parts_workOrderId_idx" ON "maintenance_parts"("workOrderId");
ALTER TABLE "maintenance_parts" ADD CONSTRAINT "maintenance_parts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "maintenance_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Fuel ────────────────────────────────────────────────────────────────────
CREATE TABLE "fuel_cards" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "provider" TEXT,
  "pinHint" TEXT,
  "assignedDriverId" TEXT,
  "assignedVehicleId" TEXT,
  "monthlyLimit" DECIMAL(12,2),
  "monthlySpend" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "fuel_cards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fuel_cards_organizationId_cardNumber_key" ON "fuel_cards"("organizationId","cardNumber");
ALTER TABLE "fuel_cards" ADD CONSTRAINT "fuel_cards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_cards" ADD CONSTRAINT "fuel_cards_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "fuel_logs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT,
  "fuelCardId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "liters" DECIMAL(10,2) NOT NULL,
  "cost" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "pricePerLiter" DECIMAL(10,3),
  "odometerKm" DECIMAL(12,2) NOT NULL,
  "stationName" TEXT,
  "stationBrand" TEXT,
  "receiptUrl" TEXT,
  "consumptionPer100Km" DECIMAL(8,2),
  "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
  "anomalyNote" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fuel_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fuel_logs_vehicleId_date_idx" ON "fuel_logs"("vehicleId","date");
CREATE INDEX "fuel_logs_organizationId_date_idx" ON "fuel_logs"("organizationId","date");
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_fuelCardId_fkey" FOREIGN KEY ("fuelCardId") REFERENCES "fuel_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Compliance ──────────────────────────────────────────────────────────────
CREATE TABLE "compliance_documents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "DocumentType" NOT NULL,
  "vehicleId" TEXT,
  "driverId" TEXT,
  "customerId" TEXT,
  "title" TEXT NOT NULL,
  "documentNumber" TEXT,
  "issuedBy" TEXT,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "fileUrl" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectReason" TEXT,
  "alertLevels" JSONB,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compliance_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "compliance_documents_organizationId_status_idx" ON "compliance_documents"("organizationId","status");
CREATE INDEX "compliance_documents_expiryDate_idx" ON "compliance_documents"("expiryDate");
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "inspection_records" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT,
  "type" "ChecklistType" NOT NULL,
  "results" JSONB NOT NULL,
  "overallPass" BOOLEAN NOT NULL,
  "photoUrls" JSONB,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspection_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inspection_records_vehicleId_submittedAt_idx" ON "inspection_records"("vehicleId","submittedAt");
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "incident_reports" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "vehicleId" TEXT,
  "driverId" TEXT,
  "orderId" TEXT,
  "type" "IncidentType" NOT NULL,
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'LOW',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "locationText" TEXT,
  "description" TEXT NOT NULL,
  "photoUrls" JSONB,
  "policeReportRef" TEXT,
  "estimatedLoss" DECIMAL(12,2),
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolution" TEXT,
  "aiAnalysis" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "incident_reports_number_key" ON "incident_reports"("number");
CREATE INDEX "incident_reports_organizationId_status_idx" ON "incident_reports"("organizationId","status");
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Pricing, Invoicing & Payments ───────────────────────────────────────────
CREATE TABLE "pricing_rules" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "model" "PricingModel" NOT NULL,
  "vehicleType" "VehicleType",
  "orderType" "OrderType",
  "zoneName" TEXT,
  "customerId" TEXT,
  "ratePerKm" DECIMAL(10,3),
  "ratePerKg" DECIMAL(10,3),
  "flatRate" DECIMAL(12,2),
  "minCharge" DECIMAL(12,2),
  "fuelSurchargePct" DECIMAL(5,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pricing_rules_organizationId_isActive_idx" ON "pricing_rules"("organizationId","isActive");
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "recurrence" TEXT,
  "pdfUrl" TEXT,
  "stripePaymentLinkUrl" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");
CREATE INDEX "invoices_organizationId_status_idx" ON "invoices"("organizationId","status");
CREATE INDEX "invoices_customerId_status_idx" ON "invoices"("customerId","status");
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "invoice_lines" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "orderId" TEXT,
  "type" "LineItemType" NOT NULL DEFAULT 'DELIVERY_FEE',
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invoice_lines_invoiceId_idx" ON "invoice_lines"("invoiceId");
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
  "reference" TEXT,
  "stripePaymentIntentId" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedBy" TEXT,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");
CREATE INDEX "payments_organizationId_paidAt_idx" ON "payments"("organizationId","paidAt");
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "credit_notes" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "credit_notes_number_key" ON "credit_notes"("number");
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Notifications ───────────────────────────────────────────────────────────
CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT,
  "type" "NotificationType" NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "payload" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId","isRead");
CREATE INDEX "notifications_organizationId_createdAt_idx" ON "notifications"("organizationId","createdAt");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "inApp" BOOLEAN NOT NULL DEFAULT true,
  "email" BOOLEAN NOT NULL DEFAULT false,
  "push" BOOLEAN NOT NULL DEFAULT true,
  "webPush" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_preferences_userId_type_key" ON "notification_preferences"("userId","type");
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AI & Analytics ──────────────────────────────────────────────────────────
CREATE TABLE "ai_usage_logs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT,
  "feature" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptTokens" INTEGER NOT NULL DEFAULT 0,
  "completionTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "latencyMs" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_usage_logs_organizationId_feature_createdAt_idx" ON "ai_usage_logs"("organizationId","feature","createdAt");
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_snapshots" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "metrics" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analytics_snapshots_organizationId_scope_periodStart_idx" ON "analytics_snapshots"("organizationId","scope","periodStart");

CREATE TABLE "scheduled_reports" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "recipients" JSONB NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'pdf',
  "cronExpression" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scheduled_reports_organizationId_isActive_idx" ON "scheduled_reports"("organizationId","isActive");
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Audit & Messaging ───────────────────────────────────────────────────────
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId","createdAt");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType","entityId");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "driver_messages" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "senderId" TEXT,
  "receiverId" TEXT,
  "orderId" TEXT,
  "body" TEXT NOT NULL,
  "isFromDriver" BOOLEAN NOT NULL DEFAULT false,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "driver_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "driver_messages_driverId_createdAt_idx" ON "driver_messages"("driverId","createdAt");
ALTER TABLE "driver_messages" ADD CONSTRAINT "driver_messages_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driver_messages" ADD CONSTRAINT "driver_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "driver_messages" ADD CONSTRAINT "driver_messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Full-text & trigram indexes (pg_trgm search) ────────────────────────────
CREATE INDEX "orders_search_trgm" ON "orders" USING GIN ("deliveryAddressLine" gin_trgm_ops);
CREATE INDEX "customers_search_trgm" ON "customers" USING GIN ("companyName" gin_trgm_ops);
CREATE INDEX "inventory_items_search_trgm" ON "inventory_items" USING GIN ("name" gin_trgm_ops);
