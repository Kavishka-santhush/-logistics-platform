/* =============================================================================
 * Logistics & Fleet Management Platform — Prisma Seed
 * Idempotent-ish demo dataset for a fresh database.
 * Run with: npm run prisma:seed  (prisma db seed)
 * NOTE: this file only defines content; it is never executed by the agent.
 * ========================================================================== */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── small helpers ───────────────────────────────────────────────────────────
const day = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (offsetDays) => new Date(now + offsetDays * day);
const pad = (n, w = 4) => String(n).padStart(w, '0');
const ymd = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, '');
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7).replace('-', '');

// deterministic public tracking codes
let trkSeq = 0;
const tracking = () => `TRK${(100000 + trkSeq++).toString(36).toUpperCase()}${pad(trkSeq, 3)}`;
const orderNo = (seq) => `ORD-${ymd()}-${pad(seq, 6)}`;
const invNo = (seq) => `INV-${monthKey()}-${pad(seq, 5)}`;
const mwoNo = (seq) => `MWO-${ymd()}-${pad(seq, 4)}`;
const incNo = (seq) => `INC-${ymd()}-${pad(seq, 4)}`;
const grnNo = (seq) => `GRN-${ymd()}-${pad(seq, 4)}`;
const cnNo = (seq) => `CN-${ymd()}-${pad(seq, 4)}`;

async function wipe() {
  // child → parent order to respect FK constraints
  const models = [
    'deliveryRating', 'driverMessage', 'auditLog', 'scheduledReport', 'analyticsSnapshot',
    'aiUsageLog', 'notificationPreference', 'notification', 'creditNote', 'payment',
    'invoiceLine', 'invoice', 'pricingRule', 'slaBreach', 'customerContract',
    'customerAddress', 'complianceDocument', 'inspectionRecord', 'incidentReport',
    'hoursOfServiceLog', 'driverPerformanceSnapshot', 'driverShift', 'driverLeave',
    'driverTraining', 'maintenancePart', 'maintenanceWorkOrder', 'maintenanceSchedule',
    'maintenanceVendor', 'fuelLog', 'fuelCard', 'stockAdjustment', 'stockMovement',
    'warehouseTask', 'inboundShipment', 'inventoryItem', 'warehouseZone', 'warehouse',
    'geofenceAlert', 'geofence', 'trackingPoint', 'vehicleTelematics', 'dispatch',
    'routeStop', 'route', 'routeTemplate', 'shipment', 'proofOfDelivery', 'orderNote',
    'orderEvent', 'package', 'order', 'customer', 'driver', 'vehicle', 'branch',
    'subscriptionPlan', 'user', 'organization',
  ];
  for (const m of models) {
    try {
      await prisma[m].deleteMany();
    } catch (e) {
      // model may not exist / already empty — ignore
    }
  }
}

async function seedPlans() {
  const plans = [
    {
      tier: 'STARTER', name: 'Starter', description: 'Small fleets getting started',
      priceMonthly: 49, priceYearly: 490, vehicleLimit: 5, driverLimit: 3,
      features: { ai: false, tracking: 'basic', reports: 'basic', whiteLabel: false, apiAccess: false },
    },
    {
      tier: 'PROFESSIONAL', name: 'Professional', description: 'Growing operations',
      priceMonthly: 199, priceYearly: 1990, vehicleLimit: 25, driverLimit: 20,
      features: { ai: 'route', tracking: 'full', reports: 'advanced', whiteLabel: false, apiAccess: false, customerPortal: true },
    },
    {
      tier: 'BUSINESS', name: 'Business', description: 'Scaling companies',
      priceMonthly: 499, priceYearly: 4990, vehicleLimit: 100, driverLimit: -1,
      features: { ai: 'all', tracking: 'full', reports: 'advanced', whiteLabel: true, apiAccess: true, customerPortal: true, multiWarehouse: true },
    },
    {
      tier: 'ENTERPRISE', name: 'Enterprise', description: 'Unlimited, custom integrations',
      priceMonthly: 1299, priceYearly: 12990, vehicleLimit: -1, driverLimit: -1,
      features: { ai: 'all', tracking: 'full', reports: 'all', whiteLabel: true, apiAccess: true, customerPortal: true, multiWarehouse: true, dedicatedSupport: true, sla: true, customIntegrations: true },
    },
  ];
  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({ where: { tier: p.tier }, update: p, create: p });
  }
}

async function seedOrgAndUsers() {
  // Platform super admin (no organization)
  const superAdmin = await prisma.user.create({
    data: {
      clerkId: 'clerk_super_admin', email: 'root@quodor.io', firstName: 'Platform', lastName: 'Owner',
      role: 'SUPER_ADMIN', status: 'ACTIVE', phone: '+1-555-0100', timezone: 'UTC',
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'SwiftFreight Logistics', slug: 'swiftfreight', email: 'ops@swiftfreight.example',
      phone: '+1-555-0199', taxNumber: 'TAX-88231', website: 'https://swiftfreight.example',
      addressLine: '1200 Harbor Way', city: 'Rotterdam', country: 'NL',
      latitude: 51.9244, longitude: 4.4777,
      currency: 'EUR', timezone: 'Europe/Amsterdam', distanceUnit: 'KM', weightUnit: 'KG',
      speedLimitKmh: 90, idleAlertMins: 15,
      workingHours: { mon: ['08:00', '18:00'], tue: ['08:00', '18:00'], wed: ['08:00', '18:00'], thu: ['08:00', '18:00'], fri: ['08:00', '18:00'], sat: ['09:00', '13:00'], sun: [] },
      operatingRegions: [{ name: 'Benelux', center: { lat: 51.9, lng: 4.48 }, radius: 200000 }],
      subscriptionTier: 'BUSINESS', subscriptionStatus: 'ACTIVE', trialEndsAt: at(-120),
    },
  });

  // Second tenant org to demonstrate isolation
  const org2 = await prisma.organization.create({
    data: {
      name: 'Nordic Couriers', slug: 'nordiccouriers', email: 'hello@nordic.example',
      city: 'Oslo', country: 'NO', latitude: 59.9139, longitude: 10.7522,
      currency: 'EUR', subscriptionTier: 'PROFESSIONAL', subscriptionStatus: 'TRIALING', trialEndsAt: at(10),
    },
  });

  const branches = [];
  for (const b of [
    { name: 'Rotterdam Central', code: 'RTM-01', city: 'Rotterdam', latitude: 51.9244, longitude: 4.4777, capacity: 40, managerName: 'Bram de Vries' },
    { name: 'Utrecht Depot', code: 'UTR-02', city: 'Utrecht', latitude: 52.0907, longitude: 5.1214, capacity: 20, managerName: 'Sanne Bakker' },
  ]) {
    branches.push(await prisma.branch.create({ data: { organizationId: org.id, ...b } }));
  }
  const org2Branch = await prisma.branch.create({
    data: { organizationId: org2.id, name: 'Oslo Main', code: 'OSL-01', city: 'Oslo', latitude: 59.9139, longitude: 10.7522, capacity: 15 },
  });

  const staff = [
    { email: 'admin@swiftfreight.example', firstName: 'Ava', lastName: 'Jansen', role: 'ORG_ADMIN', phone: '+1-555-0201' },
    { email: 'ops@swiftfreight.example', firstName: 'Liam', lastName: 'Visser', role: 'OPS_MANAGER', phone: '+1-555-0202' },
    { email: 'dispatch@swiftfreight.example', firstName: 'Noor', lastName: 'Mulder', role: 'DISPATCHER', phone: '+1-555-0203' },
    { email: 'wh@swiftfreight.example', firstName: 'Tom', lastName: 'de Boer', role: 'WAREHOUSE_MANAGER', phone: '+1-555-0204' },
    { email: 'compliance@swiftfreight.example', firstName: 'Iris', lastName: 'Bosma', role: 'COMPLIANCE_OFFICER', phone: '+1-555-0205' },
    { email: 'finance@swiftfreight.example', firstName: 'Kaya', lastName: 'Peters', role: 'FINANCE_MANAGER', phone: '+1-555-0206' },
  ];
  const users = { superAdmin, staff: {} };
  for (const s of staff) {
    users.staff[s.role] = await prisma.user.create({
      data: { clerkId: `clerk_${s.role.toLowerCase()}`, organizationId: org.id, status: 'ACTIVE', timezone: 'Europe/Amsterdam', ...s },
    });
  }

  // driver auth accounts
  const driverUsers = [];
  const driverNames = [
    ['Dirk', 'Hendriks', 'driver1@swiftfreight.example'],
    ['Fatima', 'El Amrani', 'driver2@swiftfreight.example'],
    ['Piotr', 'Kowalski', 'driver3@swiftfreight.example'],
    ['Mei', 'Tanaka', 'driver4@swiftfreight.example'],
  ];
  for (const [fn, ln, email] of driverNames) {
    driverUsers.push(await prisma.user.create({
      data: { clerkId: `clerk_drv_${ln.toLowerCase()}`, organizationId: org.id, role: 'DRIVER', status: 'ACTIVE', email, firstName: fn, lastName: ln, phone: '+1-555-03' + pad(driverUsers.length + 10, 2), timezone: 'Europe/Amsterdam', pushToken: `ExponentPushToken[demo-${ln.toLowerCase()}]` },
    }));
  }

  // customer portal accounts
  const customerUsers = [];
  for (const [fn, ln, email] of [['Account', 'Acme', 'ap@acme.example'], ['Ops', 'Globex', 'shipping@globex.example']]) {
    customerUsers.push(await prisma.user.create({
      data: { clerkId: `clerk_cust_${ln.toLowerCase()}`, organizationId: org.id, role: 'CUSTOMER', status: 'ACTIVE', email, firstName: fn, lastName: ln },
    }));
  }

  // org2 admin
  const org2Admin = await prisma.user.create({
    data: { clerkId: 'clerk_org2_admin', organizationId: org2.id, role: 'ORG_ADMIN', status: 'ACTIVE', email: 'admin@nordic.example', firstName: 'Ingrid', lastName: 'Hansen' },
  });

  return { org, org2, branches, org2Branch, users, driverUsers, customerUsers, org2Admin };
}

async function seedDrivers(ctx) {
  const { org, branches } = ctx;
  const specs = [
    { user: ctx.driverUsers[0], name: 'Dirk Hendriks', employeeId: 'DRV-0001', branch: branches[0], licenseExpiry: at(240), phone: '+1-555-0310', status: 'ON_DELIVERY', rating: 4.6, perf: 88 },
    { user: ctx.driverUsers[1], name: 'Fatima El Amrani', employeeId: 'DRV-0002', branch: branches[0], licenseExpiry: at(5), phone: '+1-555-0311', status: 'AVAILABLE', rating: 4.9, perf: 94 },
    { user: ctx.driverUsers[2], name: 'Piotr Kowalski', employeeId: 'DRV-0003', branch: branches[1], licenseExpiry: at(-20), phone: '+1-555-0312', status: 'AVAILABLE', rating: 4.1, perf: 76 },
    { user: ctx.driverUsers[3], name: 'Mei Tanaka', employeeId: 'DRV-0004', branch: branches[1], licenseExpiry: at(400), phone: '+1-555-0313', status: 'ON_LEAVE', rating: 4.4, perf: 82 },
  ];
  const drivers = [];
  for (const s of specs) {
    drivers.push(await prisma.driver.create({
      data: {
        organizationId: org.id, branchId: s.branch.id, userId: s.user.id,
        employeeId: s.employeeId, name: s.name, phone: s.phone, email: `${s.employeeId.toLowerCase()}@swiftfreight.example`,
        addressLine: 'Adresstraat 12', city: s.branch.city, bloodGroup: 'O+',
        emergencyContactName: 'Next of Kin', emergencyContactPhone: '+1-555-0999',
        joinDate: at(-400 - drivers.length * 30), contractType: 'FULL_TIME', salary: 2600 + drivers.length * 120,
        allowances: [{ name: 'meal', amount: 150 }], deductions: [],
        licenseNumber: `NL-${s.employeeId}`, licenseClass: 'C', licenseIssueDate: at(-1500), licenseExpiryDate: s.licenseExpiry,
        status: s.status, ratingAvg: s.rating, ratingCount: 20 + drivers.length * 6, performanceScore: s.perf,
        onTimeRate: s.perf + 2, successRate: 96, fuelEfficiencyScore: s.perf - 5, violationCount: drivers.length % 3,
      },
    }));
  }

  // trainings, leaves, shifts, HOS, performance snapshots
  await prisma.driverTraining.create({
    data: { driverId: drivers[0].id, name: 'Defensive Driving', provider: 'RoadSafe', completedAt: at(-120), expiresAt: at(240) },
  });
  await prisma.driverLeave.create({
    data: { driverId: drivers[3].id, type: 'ANNUAL', startDate: at(-2), endDate: at(5), reason: 'Family', status: 'APPROVED', approvedBy: ctx.users.staff.ORG_ADMIN.id, approvedAt: at(-10) },
  });
  for (let i = 0; i < 3; i++) {
    await prisma.driverShift.create({
      data: { organizationId: org.id, driverId: drivers[i].id, branchId: drivers[i].branchId, shiftDate: at(i), startTime: '08:00', endTime: '17:00', label: 'Morning' },
    });
  }
  for (const d of drivers) {
    await prisma.hoursOfServiceLog.create({
      data: { driverId: d.id, logDate: at(-1), drivingMinutes: 420, onDutyMinutes: 500, restMinutes: 60 },
    });
    await prisma.driverPerformanceSnapshot.create({
      data: { driverId: d.id, month: new Date().getMonth() + 1, year: new Date().getFullYear(), onTimeRate: d.onTimeRate, successRate: d.successRate, deliveriesCompleted: 120, violations: d.violationCount, avgRating: d.ratingAvg, score: d.performanceScore },
    });
  }
  return drivers;
}

async function seedVehicles(ctx, drivers) {
  const { org, branches } = ctx;
  const specs = [
    { plate: 'RTM-V-101', make: 'Mercedes-Benz', model: 'Sprinter', year: 2022, type: 'VAN', fuel: 'DIESEL', kg: 1500, m3: 12, pallets: 6, status: 'ON_DELIVERY', driver: drivers[0], odo: 82000, price: 48000 },
    { plate: 'RTM-V-102', make: 'IVECO', model: 'Daily', year: 2021, type: 'SMALL_TRUCK', fuel: 'DIESEL', kg: 3500, m3: 20, pallets: 10, status: 'AVAILABLE', driver: null, odo: 120000, price: 62000 },
    { plate: 'UTR-V-201', make: 'Volvo', model: 'FH16', year: 2020, type: 'LARGE_TRUCK', fuel: 'DIESEL', kg: 24000, m3: 90, pallets: 33, status: 'AVAILABLE', driver: drivers[2], odo: 310000, price: 145000 },
    { plate: 'UTR-V-202', make: 'Scania', model: 'R450', year: 2023, type: 'CONTAINER_TRUCK', fuel: 'DIESEL', kg: 26000, m3: 0, pallets: 0, status: 'UNDER_MAINTENANCE', driver: null, odo: 55000, price: 168000 },
    { plate: 'RTM-V-103', make: 'Toyota', model: 'Proace', year: 2023, type: 'VAN', fuel: 'HYBRID', kg: 1200, m3: 6, pallets: 4, status: 'AVAILABLE', driver: drivers[1], odo: 15000, price: 39000 },
    { plate: 'RTM-M-301', make: 'Renault', model: 'Master Z.E.', year: 2022, type: 'VAN', fuel: 'ELECTRIC', kg: 1100, m3: 8, pallets: 4, status: 'AVAILABLE', driver: null, odo: 30000, price: 52000 },
    { plate: 'UTR-R-401', make: 'Mercedes-Benz', model: 'Atego Reefer', year: 2021, type: 'REFRIGERATED', fuel: 'DIESEL', kg: 8000, m3: 40, pallets: 16, status: 'AVAILABLE', driver: drivers[3], odo: 98000, price: 88000 },
    { plate: 'RTM-P-501', make: 'Ford', model: 'Transit Pickup', year: 2020, type: 'PICKUP', fuel: 'PETROL', kg: 1000, m3: 0, pallets: 0, status: 'OUT_OF_SERVICE', driver: null, odo: 150000, price: 32000 },
  ];
  const vehicles = [];
  for (const s of specs) {
    vehicles.push(await prisma.vehicle.create({
      data: {
        organizationId: org.id, branchId: s.type === 'LARGE_TRUCK' || s.type === 'CONTAINER_TRUCK' || s.type === 'REFRIGERATED' ? branches[1].id : branches[0].id,
        plateNumber: s.plate, vin: `VIN${s.plate.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`, make: s.make, model: s.model, year: s.year, color: 'White',
        type: s.type, status: s.status, weightCapacityKg: s.kg, volumeCapacityM3: s.m3, palletCapacity: s.pallets,
        fuelType: s.fuel, gpsDeviceId: `GPS-${s.plate.replace(/[^A-Z0-9]/gi, '')}`, odometerKm: s.odo, engineHours: s.odo / 40,
        isAvailable: s.status === 'AVAILABLE', purchasePrice: s.price, purchaseDate: at(-((2026 - s.year) * 365 + 30)),
        depreciationMethod: 'STRAIGHT_LINE', usefulLifeYears: 10, residualValuePct: 10,
        currentBookValue: Math.round(s.price * 0.7),
        assignedDriverId: s.driver ? s.driver.id : null,
        telematics: { speed: 0, engineOn: false, lastUpdate: at(-0.01).toISOString() },
      },
    }));
  }

  // telematics history + a live tracking trail for vehicles 0 and 2
  for (const v of [vehicles[0], vehicles[2]]) {
    for (let i = 0; i < 12; i++) {
      await prisma.vehicleTelematics.create({
        data: { vehicleId: v.id, speedKmh: 40 + i, engineOn: true, odometerKm: Number(v.odometerKm) + i, fuelLevelPct: 80 - i, recordedAt: at(-1 + i * 0.02) },
      });
    }
    for (let i = 0; i < 12; i++) {
      await prisma.trackingPoint.create({
        data: {
          organizationId: org.id, vehicleId: v.id, driverId: v.assignedDriverId, orderId: null,
          latitude: 51.9244 + i * 0.004, longitude: 4.4777 + i * 0.005, speedKmh: 45 + i, heading: 90, accuracyM: 5,
          engineOn: true, odometerKm: Number(v.odometerKm) + i, recordedAt: at(-0.2 + i * 0.01),
        },
      });
    }
  }
  return vehicles;
}

async function seedCustomers(ctx) {
  const { org } = ctx;
  const specs = [
    { companyName: 'Acme Retail Group', contactName: 'John Carter', email: 'ap@acme.example', phone: '+1-555-1001', tier: 'GOLD', creditLimit: 50000, paymentTerms: 'net30', slaHours: 24, user: ctx.customerUsers[0], billingCity: 'Amsterdam' },
    { companyName: 'Globex Manufacturing', contactName: 'Rachel Wu', email: 'shipping@globex.example', phone: '+1-555-1002', tier: 'PLATINUM', creditLimit: 120000, paymentTerms: 'net60', slaHours: 48, user: ctx.customerUsers[1], billingCity: 'Rotterdam' },
    { companyName: 'Initech Startups', contactName: 'Bob White', email: 'logistics@initech.example', phone: '+1-555-1003', tier: 'STANDARD', creditLimit: 5000, paymentTerms: 'dueOnReceipt', slaHours: 72, user: null, billingCity: 'Utrecht' },
  ];
  const customers = [];
  for (const s of specs) {
    const c = await prisma.customer.create({
      data: {
        organizationId: org.id, userId: s.user ? s.user.id : null,
        companyName: s.companyName, contactName: s.contactName, email: s.email, phone: s.phone,
        billingAddressLine: 'Corporate Plaza 1', billingCity: s.billingCity, billingTaxNumber: `VAT-${s.tier}-${pad(customers.length + 1, 3)}`,
        tier: s.tier, creditLimit: s.creditLimit, paymentTerms: s.paymentTerms, slaHours: s.slaHours,
        ratingAvg: 4 + customers.length * 0.2, ratingCount: 10 + customers.length * 5,
      },
    });
    customers.push(c);
    // address book
    await prisma.customerAddress.createMany({
      data: [
        { customerId: c.id, label: 'HQ', addressLine: 'Corporate Plaza 1', city: s.billingCity, latitude: 52.0907 + customers.length * 0.01, longitude: 5.1214, contactName: s.contactName, contactPhone: s.phone, isDefault: true },
        { customerId: c.id, label: 'Distribution Center', addressLine: 'Industry Park 44', city: s.billingCity, latitude: 51.9244, longitude: 4.4777, isDefault: false },
      ],
    });
  }
  // contract for globex
  await prisma.customerContract.create({
    data: { customerId: customers[1].id, name: 'Annual Freight Agreement 2026', startDate: at(-60), endDate: at(305), rateOverride: { perKm: 1.6, perKg: 0.0009, flat: 12 }, isActive: true },
  });
  return customers;
}

async function seedPricing(ctx) {
  const { org } = ctx;
  const rules = [
    { name: 'Default flat', model: 'FLAT', orderType: 'STANDARD', flatRate: 18, minCharge: 12, fuelSurchargePct: 8, priority: 5 },
    { name: 'Per km general', model: 'PER_KM', ratePerKm: 1.9, minCharge: 10, fuelSurchargePct: 8, priority: 9 },
    { name: 'Express per km', model: 'PER_KM', orderType: 'EXPRESS', ratePerKm: 2.6, minCharge: 20, fuelSurchargePct: 10, priority: 3 },
    { name: 'Freight per kg', model: 'PER_KG', orderType: 'B2B_FREIGHT', ratePerKg: 0.0012, minCharge: 60, fuelSurchargePct: 12, priority: 4 },
    { name: 'Same-day flat', model: 'FLAT', orderType: 'SAME_DAY', flatRate: 32, minCharge: 32, fuelSurchargePct: 10, priority: 2 },
    { name: 'Large truck zone', model: 'ZONE_BASED', vehicleType: 'LARGE_TRUCK', zoneName: 'Benelux', flatRate: 240, minCharge: 240, priority: 6 },
    { name: 'Acme override', model: 'PER_KM', customerId: ctx.customers[0].id, ratePerKm: 1.5, minCharge: 8, fuelSurchargePct: 5, priority: 1 },
  ];
  for (const r of rules) {
    await prisma.pricingRule.create({ data: { organizationId: org.id, currency: 'EUR', isActive: true, ...r } });
  }
}

async function main() {
  console.log('🧹 clearing existing seed data…');
  await wipe();

  console.log('💳 subscription plans…');
  await seedPlans();

  console.log('🏢 organizations, branches & users…');
  const ctx = await seedOrgAndUsers();

  console.log('🧑‍✈️ drivers…');
  ctx.drivers = await seedDrivers(ctx);

  console.log('🚚 vehicles…');
  ctx.vehicles = await seedVehicles(ctx, ctx.drivers);

  console.log('🏬 customers…');
  ctx.customers = await seedCustomers(ctx);

  console.log('🏷️ pricing rules…');
  await seedPricing(ctx);

  // part 2 (orders, routes, dispatch, warehouse, maintenance, fuel, compliance,
  // invoicing, notifications, analytics) is loaded from the continuation module
  const seedPartTwo = require('./seed.part2');
  await seedPartTwo(prisma, ctx, { day, at, orderNo, tracking, invNo, mwoNo, incNo, grnNo, cnNo, pad });

  console.log('\n✅ seed complete');
  console.log('   super admin : root@quodor.io');
  console.log('   org admin   : admin@swiftfreight.example');
  console.log('   finance     : finance@swiftfreight.example');
  console.log('   driver      : driver1@swiftfreight.example');
  console.log('   customer    : ap@acme.example');
}

main()
  .catch((e) => {
    console.error('❌ seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
