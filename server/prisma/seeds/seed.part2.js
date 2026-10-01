/* =============================================================================
 * Prisma Seed — Part 2 (transactional + operational records)
 * Loaded by seed.js after orgs/users/drivers/vehicles/customers exist.
 * ========================================================================== */

module.exports = async function seedPartTwo(prisma, ctx, H) {
  const { day, at, orderNo, tracking, invNo, mwoNo, incNo, grnNo, cnNo } = H;
  const { org, branches, drivers, vehicles, customers, users, driverUsers } = ctx;

  // ─── Warehouses & Inventory ────────────────────────────────────────────────
  console.log('   🏭 warehouses & inventory…');
  const wh = [];
  for (const w of [
    { name: 'Rotterdam DC', code: 'WH-RTM', city: 'Rotterdam', latitude: 51.9244, longitude: 4.4777, capacityM3: 12000, usedM3: 7400, managerName: 'Tom de Boer' },
    { name: 'Utrecht Hub', code: 'WH-UTR', city: 'Utrecht', latitude: 52.0907, longitude: 5.1214, capacityM3: 6000, usedM3: 2100, managerName: 'Sanne Bakker' },
  ]) {
    const created = await prisma.warehouse.create({ data: { organizationId: org.id, ...w } });
    await prisma.warehouseZone.createMany({
      data: [
        { warehouseId: created.id, name: 'Receiving', type: 'receiving', capacityPct: 60 },
        { warehouseId: created.id, name: 'Storage', type: 'storage', capacityPct: 70 },
        { warehouseId: created.id, name: 'Dispatch', type: 'dispatch', capacityPct: 40 },
        { warehouseId: created.id, name: 'Returns', type: 'returns', capacityPct: 15 },
      ],
    });
    wh.push(created);
  }
  const items = [];
  for (const [i, it] of [
    { sku: 'SKU-ELEC-001', name: 'Laptop Crate', category: 'electronics', quantity: 240, unit: 'pcs', minStock: 50, maxStock: 500, binLocation: 'A-01-1', unitValue: 320, weightKg: 12 },
    { sku: 'SKU-FRAG-002', name: 'Glass Panels', category: 'fragile', quantity: 80, unit: 'pcs', minStock: 20, maxStock: 200, binLocation: 'B-04-2', unitValue: 90, weightKg: 25 },
    { sku: 'SKU-FOOD-003', name: 'Chilled Meals', category: 'refrigerated', quantity: 15, unit: 'pallet', minStock: 40, maxStock: 120, binLocation: 'C-02-1', unitValue: 500, weightKg: 300 },
    { sku: 'SKU-PART-004', name: 'Auto Parts Box', category: 'industrial', quantity: 620, unit: 'pcs', minStock: 100, maxStock: 900, binLocation: 'A-08-3', unitValue: 45, weightKg: 8 },
  ].entries()) {
    const created = await prisma.inventoryItem.create({
      data: { organizationId: org.id, warehouseId: wh[i % wh.length].id, ...it },
    });
    items.push(created);
    await prisma.stockMovement.create({
      data: { organizationId: org.id, warehouseId: created.warehouseId, itemId: created.id, type: 'INBOUND', quantity: it.quantity, referenceType: 'grn', referenceId: grnNo(i + 1), operatorName: 'Tom de Boer', note: 'Opening stock', createdAt: at(-30 + i) },
    });
  }
  // low-stock movement + adjustment
  await prisma.stockMovement.create({ data: { organizationId: org.id, warehouseId: items[2].warehouseId, itemId: items[2].id, type: 'OUTBOUND', quantity: 25, referenceType: 'order', operatorName: 'Sanne Bakker', note: 'Picked for delivery' } });
  await prisma.stockAdjustment.create({ data: { itemId: items[0].id, countedQty: 238, systemQty: 240, variance: -2, reason: 'Damaged in transit', adjustedBy: users.staff.WAREHOUSE_MANAGER.id } });
  await prisma.inboundShipment.create({ data: { warehouseId: wh[0].id, grnNumber: grnNo(9), supplierName: 'TechSupplier BV', status: 'received', receivedAt: at(-3), lines: [{ sku: 'SKU-ELEC-001', name: 'Laptop Crate', qty: 100, receivedQty: 100 }] } });
  await prisma.warehouseTask.createMany({ data: [
    { warehouseId: wh[0].id, itemId: items[0].id, type: 'pick', status: 'open', assignedToName: 'Picker A', priority: 2 },
    { warehouseId: wh[0].id, itemId: items[3].id, type: 'putaway', status: 'done', assignedToName: 'Picker B', completedAt: at(-1) },
  ] });

  // ─── Orders, Packages, Events, POD, Ratings ─────────────────────────────────
  console.log('   📦 orders…');
  const cityPairs = [
    ['Rotterdam', 51.9244, 4.4777, 'Amsterdam', 52.3676, 4.9041],
    ['Utrecht', 52.0907, 5.1214, 'The Hague', 52.0705, 4.3007],
    ['Eindhoven', 51.4416, 5.4697, 'Groningen', 53.2194, 6.5665],
  ];
  const statusPlan = [
    { status: 'DELIVERED', type: 'STANDARD', prio: 'NORMAL' },
    { status: 'DELIVERED', type: 'EXPRESS', prio: 'HIGH' },
    { status: 'OUT_FOR_DELIVERY', type: 'SAME_DAY', prio: 'URGENT' },
    { status: 'IN_TRANSIT', type: 'B2B_FREIGHT', prio: 'NORMAL' },
    { status: 'PICKED_UP', type: 'STANDARD', prio: 'NORMAL' },
    { status: 'ASSIGNED', type: 'SCHEDULED', prio: 'HIGH' },
    { status: 'CONFIRMED', type: 'STANDARD', prio: 'NORMAL' },
    { status: 'FAILED', type: 'EXPRESS', prio: 'VIP' },
    { status: 'RETURNED', type: 'RETURN', prio: 'NORMAL' },
    { status: 'DRAFT', type: 'STANDARD', prio: 'NORMAL' },
    { status: 'DELIVERED', type: 'B2B_FREIGHT', prio: 'HIGH' },
    { status: 'CANCELLED', type: 'STANDARD', prio: 'NORMAL' },
  ];
  const orders = [];
  let seq = 1;
  for (const s of statusPlan) {
    const [pc, plat, plng, dc, dlat, dlng] = cityPairs[orders.length % cityPairs.length];
    const customer = customers[orders.length % customers.length];
    const driver = drivers[orders.length % drivers.length];
    const vehicle = vehicles.find((v) => v.assignedDriverId === driver.id) || vehicles[orders.length % vehicles.length];
    const distanceKm = Math.round((60 + (orders.length % 5) * 45) * 10) / 10;
    const weight = 20 + (orders.length % 4) * 15;
    const charge = Math.round((10 + distanceKm * 1.7 + weight * 0.05) * 100) / 100;
    const isCOD = orders.length % 5 === 0;
    const createdAt = at(-(statusPlan.length - orders.length) - 1);
    const delivered = s.status === 'DELIVERED';
    const promisedAt = new Date(createdAt.getTime() + (customer.slaHours || 24) * 3600 * 1000);
    const late = delivered && orders.length % 4 === 1;

    const order = await prisma.order.create({
      data: {
        organizationId: org.id, branchId: branches[0].id, customerId: customer.id,
        orderNumber: orderNo(seq), trackingNumber: tracking(), type: s.type, priority: s.prio, status: s.status,
        pickupAddressLine: 'Warehouse Loading Bay 1', pickupCity: pc, pickupLatitude: plat, pickupLongitude: plng,
        pickupContactName: 'Dock Clerk', pickupContactPhone: '+1-555-0400', scheduledPickupAt: new Date(createdAt.getTime() + 3600 * 1000),
        deliveryAddressLine: 'Customer Site ' + seq, deliveryCity: dc, deliveryLatitude: dlat, deliveryLongitude: dlng,
        deliveryContactName: 'Reception', deliveryContactPhone: '+1-555-0401',
        scheduledDeliveryAt: promisedAt, promisedAt, isLate: late,
        deliveryWindowStart: '09:00', deliveryWindowEnd: '17:00',
        totalWeightKg: weight, totalVolumeM3: weight * 0.005, totalDeclaredValue: charge * 8,
        distanceKm, chargeAmount: charge, currency: 'EUR',
        isCOD, codAmount: isCOD ? charge : 0, codCollected: isCOD && delivered ? charge : 0, codReconciledAt: isCOD && delivered ? promisedAt : null,
        pickedUpAt: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'].includes(s.status) ? new Date(createdAt.getTime() + 2 * 3600 * 1000) : null,
        deliveredAt: delivered ? new Date(createdAt.getTime() + (late ? 30 : 6) * 3600 * 1000) : null,
        failedAt: s.status === 'FAILED' ? new Date(createdAt.getTime() + 8 * 3600 * 1000) : null,
        failedReason: s.status === 'FAILED' ? 'RECIPIENT_ABSENT' : null,
        failedNote: s.status === 'FAILED' ? 'No one at the address' : null,
        cancelledAt: s.status === 'CANCELLED' ? createdAt : null,
        cancellationReason: s.status === 'CANCELLED' ? 'Customer changed mind' : null,
        assignedDriverId: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'].includes(s.status) ? driver.id : null,
        assignedVehicleId: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'].includes(s.status) ? vehicle.id : null,
        source: 'manual', createdBy: users.staff.OPS_MANAGER.id, createdAt,
        specialInstructions: isCOD ? 'Collect payment before handover' : null,
      },
    });
    orders.push(order);
    seq++;

    // packages
    const pkgCount = 1 + (orders.length % 3);
    for (let p = 0; p < pkgCount; p++) {
      await prisma.package.create({
        data: {
          orderId: order.id, barcode: `PKG${order.orderNumber.slice(-6)}${p}`, type: p === 0 ? 'PARCEL' : 'DOCUMENT',
          description: `Piece ${p + 1}`, weightKg: Math.round((weight / pkgCount) * 100) / 100,
          lengthCm: 40, widthCm: 30, heightCm: 20, quantity: 1, declaredValue: Math.round((charge * 8) / pkgCount),
          handlingFlags: { fragile: p === 1, hazardous: false }, status: delivered ? 'DELIVERED' : 'IN_TRANSIT', createdAt,
        },
      });
    }

    // events timeline
    const eventFlow = { DRAFT: ['DRAFT'], CONFIRMED: ['DRAFT', 'CONFIRMED'], ASSIGNED: ['DRAFT', 'CONFIRMED', 'ASSIGNED'], PICKED_UP: ['DRAFT', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP'], IN_TRANSIT: ['DRAFT', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'], OUT_FOR_DELIVERY: ['DRAFT', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'], DELIVERED: ['DRAFT', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'], FAILED: ['DRAFT', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'FAILED'], RETURNED: ['DRAFT', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'], CANCELLED: ['DRAFT', 'CONFIRMED', 'CANCELLED'] }[s.status] || ['DRAFT'];
    for (let e = 0; e < eventFlow.length; e++) {
      await prisma.orderEvent.create({
        data: { orderId: order.id, status: eventFlow[e], note: `${eventFlow[e]} transition`, actorId: users.staff.DISPATCHER.id, createdAt: new Date(createdAt.getTime() + e * 3600 * 1000) },
      });
    }
    await prisma.orderNote.create({ data: { orderId: order.id, authorId: users.staff.OPS_MANAGER.id, body: 'Handle with care on the loading dock.', visibility: 'internal', createdAt } });

    if (delivered) {
      await prisma.proofOfDelivery.create({
        data: { orderId: order.id, signatureUrl: '/uploads/pod/sign-' + order.id.slice(0, 8) + '.png', photoUrls: ['/uploads/pod/photo-' + order.id.slice(0, 8) + '.jpg'], capturedName: 'Reception Desk', latitude: order.deliveryLatitude, longitude: order.deliveryLongitude, codCollected: isCOD ? charge : 0, capturedAt: order.deliveredAt, metadata: { device: 'driver-android-01' } },
      });
      await prisma.deliveryRating.create({
        data: { orderId: order.id, customerId: customer.id, driverId: order.assignedDriverId, reviewerId: customer.userId, stars: late ? 3 : 5, punctuality: late ? 3 : 5, handling: 5, comment: late ? 'A bit late but careful.' : 'Excellent delivery.' },
      });
      if (late) {
        await prisma.slaBreach.create({ data: { customerId: customer.id, orderId: order.id, orderNo: order.orderNumber, minutesLate: 360, breachedAt: order.deliveredAt } });
      }
    }
    await prisma.shipment.create({ data: { orderId: order.id, status: delivered ? 'DELIVERED' : s.status === 'FAILED' ? 'FAILED' : 'IN_TRANSIT', originWarehouseId: wh[0].id, destinationText: order.deliveryCity, etaAt: promisedAt, lastUpdatedAt: order.updatedAt || createdAt } });
  }

  // ─── Route Templates & Routes with Stops ────────────────────────────────────
  console.log('   🗺️ routes & dispatch…');
  const template = await prisma.routeTemplate.create({
    data: { organizationId: org.id, name: 'R4 Daily South', waypoints: [{ lat: 51.9244, lng: 4.4777, address: 'RTM DC' }, { lat: 51.4416, lng: 5.4697, address: 'Eindhoven' }], distanceKm: 118, createdAt: at(-40) },
  });

  const activeOrders = orders.filter((o) => ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.status));
  const route = await prisma.route.create({
    data: {
      organizationId: org.id, name: 'Route ' + ymdSafe(), date: at(0), status: 'IN_PROGRESS',
      waypoints: activeOrders.map((o, i) => ({ sequence: i + 1, lat: Number(o.deliveryLatitude), lng: Number(o.deliveryLongitude), address: o.deliveryAddressLine, orderId: o.id })),
      totalDistanceKm: 145.5, totalDurationMin: 260, plannedBy: users.staff.DISPATCHER.id, templateId: template.id,
      driverId: drivers[0].id, vehicleId: vehicles[0].id, isOptimized: true,
      optimizationData: { aiModel: 'openai/gpt-4o', savingsPct: 14, originalDistance: 169, fuelEstimate: 32 },
      startedAt: at(-0.2), createdAt: at(-0.5),
    },
  });
  for (let i = 0; i < activeOrders.length; i++) {
    const o = activeOrders[i];
    await prisma.routeStop.create({
      data: { routeId: route.id, orderId: o.id, sequence: i + 1, status: i === 0 ? 'COMPLETED' : i === 1 ? 'ARRIVED' : 'PENDING', addressLine: o.deliveryAddressLine, latitude: o.deliveryLatitude, longitude: o.deliveryLongitude, windowStart: at(0), windowEnd: at(0.5), etaAt: new Date(Date.now() + i * 45 * 60 * 1000), arrivedAt: i <= 1 ? new Date() : null, completedAt: i === 0 ? new Date() : null, distanceFromPrevKm: 20 + i * 8 },
    });
    await prisma.order.update({ where: { id: o.id }, data: { routeId: route.id } });
  }

  for (const o of orders.filter((x) => x.assignedDriverId && !x.routeId).slice(0, 4)) {
    await prisma.dispatch.create({
      data: { organizationId: org.id, mode: 'SINGLE_ORDER', status: 'ACCEPTED', orderId: o.id, driverId: o.assignedDriverId, vehicleId: o.assignedVehicleId, dispatchedAt: at(-1), acceptedAt: at(-0.9), createdBy: users.staff.DISPATCHER.id },
    });
  }

  // ─── Geofences & Alerts ─────────────────────────────────────────────────────
  console.log('   📡 geofences & alerts…');
  const gf = await prisma.geofence.create({
    data: { organizationId: org.id, name: 'Rotterdam DC Zone', type: 'circle', centerLat: 51.9244, centerLng: 4.4777, radiusM: 1500, alertOn: { enter: true, exit: true } },
  });
  const gf2 = await prisma.geofence.create({
    data: { organizationId: org.id, name: 'City Center Low-Emission', type: 'polygon', polygon: [[51.92, 4.47], [51.93, 4.47], [51.93, 4.49], [51.92, 4.49]], alertOn: { enter: true, exit: false } },
  });
  await prisma.geofenceAlert.createMany({ data: [
    { geofenceId: gf.id, vehicleId: vehicles[0].id, driverId: vehicles[0].assignedDriverId, eventType: 'exit', latitude: 51.93, longitude: 4.48, triggeredAt: at(-0.3) },
    { geofenceId: gf2.id, vehicleId: vehicles[2].id, driverId: vehicles[2].assignedDriverId, eventType: 'enter', latitude: 51.925, longitude: 4.478, triggeredAt: at(-0.1), acknowledgedAt: at(-0.05) },
  ] });

  // ─── Maintenance ────────────────────────────────────────────────────────────
  console.log('   🔧 maintenance…');
  const vendor = await prisma.maintenanceVendor.create({
    data: { organizationId: org.id, name: 'Delta Truck Service', contactPerson: 'Hans Weber', phone: '+1-555-0700', email: 'service@deltatruck.example', addressLine: 'Werkstraat 5', specialties: ['engine', 'brakes', 'tyres'], hourlyRate: 65, rating: 4.5 },
  });
  const schedules = [];
  for (const [i, v] of vehicles.slice(0, 5).entries()) {
    const trig = i % 2 === 0 ? 'KM' : 'CALENDAR';
    const lastDoneKm = Number(v.odometerKm) - 5000 - i * 1000;
    schedules.push(await prisma.maintenanceSchedule.create({
      data: { vehicleId: v.id, type: ['OIL_CHANGE', 'TIRE_ROTATION', 'BRAKE_SERVICE', 'GENERAL_INSPECTION', 'AC_SERVICE'][i], trigger: trig, kmInterval: 15000, daysInterval: 180, hoursInterval: 500, lastDoneAt: at(-90 - i * 5), lastDoneKm, nextDueKm: trig === 'KM' ? lastDoneKm + 15000 : null, nextDueAt: trig === 'CALENDAR' ? at(3 + i) : at(-2 + i) },
    }));
  }
  await prisma.maintenanceWorkOrder.createMany({ data: [
    { organizationId: org.id, vehicleId: vehicles[3].id, scheduleId: schedules[3] ? schedules[3].id : null, vendorId: vendor.id, number: mwoNo(1), type: 'ENGINE_SERVICE', status: 'IN_PROGRESS', description: 'Scheduled at major service', scheduledAt: at(0), startedAt: at(-1), estimatedCost: 1200, currency: 'EUR' },
    { organizationId: org.id, vehicleId: vehicles[0].id, vendorId: vendor.id, number: mwoNo(2), type: 'OIL_CHANGE', status: 'COMPLETED', description: 'Oil + filter', scheduledAt: at(-30), startedAt: at(-30), completedAt: at(-29), downtimeHours: 4, mileageAtService: Number(vehicles[0].odometerKm) - 500, estimatedCost: 220, actualCost: 205, currency: 'EUR' },
    { organizationId: org.id, vehicleId: vehicles[7].id, number: mwoNo(3), type: 'BRAKE_SERVICE', status: 'OVERDUE', description: 'Rear brakes worn', scheduledAt: at(-6), estimatedCost: 480, currency: 'EUR' },
  ] });
  const wo2 = await prisma.maintenanceWorkOrder.findFirst({ where: { number: mwoNo(2) } });
  if (wo2) {
    await prisma.maintenancePart.createMany({ data: [
      { workOrderId: wo2.id, name: 'Engine oil 5W30 (5L)', partNumber: 'OIL-5W30-5L', quantity: 2, unitCost: 42 },
      { workOrderId: wo2.id, name: 'Oil filter', partNumber: 'OF-2231', quantity: 1, unitCost: 18 },
    ] });
  }

  // ─── Fuel ───────────────────────────────────────────────────────────────────
  console.log('   ⛽ fuel…');
  const fuelCard = await prisma.fuelCard.create({
    data: { organizationId: org.id, cardNumber: '**** 4821', provider: 'Shell', assignedDriverId: drivers[0].id, assignedVehicleId: vehicles[0].id, monthlyLimit: 2000, monthlySpend: 640 },
  });
  for (const [i, v] of vehicles.slice(0, 5).entries()) {
    const liters = 60 + i * 12;
    const cost = Math.round(liters * 1.72 * 100) / 100;
    await prisma.fuelLog.create({
      data: { organizationId: org.id, vehicleId: v.id, driverId: v.assignedDriverId, fuelCardId: i === 0 ? fuelCard.id : null, date: at(-i * 4 - 1), liters, cost, currency: 'EUR', pricePerLiter: 1.72, odometerKm: Number(v.odometerKm) - i * 300, stationName: 'TotalEnergies RTM', stationBrand: 'Total', consumptionPer100Km: 8.5 + i * 0.7, isAnomaly: i === 4, anomalyNote: i === 4 ? 'Unusually high consumption vs baseline' : null, source: 'mobile' },
    });
  }

  // ─── Compliance Documents & Inspections ─────────────────────────────────────
  console.log('   📄 compliance & inspections…');
  const docs = [];
  for (const v of vehicles.slice(0, 6)) {
    const expiring = vehicles.indexOf(v) === 3;
    docs.push(await prisma.complianceDocument.create({
      data: { organizationId: org.id, type: 'VEHICLE_REGISTRATION', vehicleId: v.id, title: `Registration ${v.plateNumber}`, documentNumber: `RDW-${v.plateNumber}`, issuedBy: 'RDW', issueDate: at(-700), expiryDate: expiring ? at(6) : at(400 + vehicles.indexOf(v) * 30), fileUrl: `/uploads/documents/reg-${v.id.slice(0, 8)}.pdf`, status: 'APPROVED', reviewedBy: users.staff.COMPLIANCE_OFFICER.id, reviewedAt: at(-690), alertLevels: expiring ? { 60: true } : null },
    }));
    await prisma.complianceDocument.create({
      data: { organizationId: org.id, type: 'INSURANCE', vehicleId: v.id, title: `Insurance ${v.plateNumber}`, issuedBy: 'Allianz', expiryDate: at(30 - vehicles.indexOf(v) * 20), fileUrl: `/uploads/documents/ins-${v.id.slice(0, 8)}.pdf`, status: 'PENDING_REVIEW' },
    });
  }
  for (const d of drivers) {
    await prisma.complianceDocument.create({
      data: { organizationId: org.id, type: 'DRIVER_LICENSE', driverId: d.id, title: `License ${d.employeeId}`, documentNumber: d.licenseNumber, issuedBy: 'RDW', issueDate: d.licenseIssueDate, expiryDate: d.licenseExpiryDate, fileUrl: `/uploads/documents/lic-${d.id.slice(0, 8)}.pdf`, status: d.licenseExpiryDate < new Date() ? 'EXPIRED' : 'APPROVED' },
    });
  }
  await prisma.inspectionRecord.create({
    data: { organizationId: org.id, vehicleId: vehicles[0].id, driverId: drivers[0].id, type: 'PRE_TRIP', results: [{ item: 'Tires', pass: true }, { item: 'Lights', pass: true }, { item: 'Brakes', pass: false, note: 'squeal' }, { item: 'Fuel', pass: true }], overallPass: false, photoUrls: ['/uploads/inspection/tire-1.jpg'], submittedAt: at(-0.2) },
  });
  await prisma.incidentReport.create({
    data: { organizationId: org.id, number: incNo(1), vehicleId: vehicles[1].id, driverId: drivers[2].id, type: 'BREAKDOWN', severity: 'MEDIUM', occurredAt: at(-2), latitude: 52.0, longitude: 5.1, locationText: 'A12 km 45', description: 'Overheated, pulled over', photoUrls: ['/uploads/incident/1.jpg'], estimatedLoss: 300, status: 'investigating' },
  });

  // ─── Invoices, Payments, Credit Notes ───────────────────────────────────────
  console.log('   🧾 invoices & payments…');
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED' || o.status === 'RETURNED');
  let invSeq = 1;
  for (const [ci, customer] of customers.entries()) {
    const custOrders = deliveredOrders.filter((o) => o.customerId === customer.id);
    if (!custOrders.length) continue;
    const subtotal = custOrders.reduce((s, o) => s + Number(o.chargeAmount || 0), 0);
    const tax = Math.round(subtotal * 0.21 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const status = ci === 0 ? 'PAID' : ci === 1 ? 'SENT' : 'OVERDUE';
    const amountPaid = status === 'PAID' ? total : status === 'OVERDUE' ? Math.round(total * 0.4 * 100) / 100 : 0;
    const issueDate = at(-35 + ci * 5);
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id, customerId: customer.id, number: invNo(invSeq), status, issueDate,
        dueDate: new Date(issueDate.getTime() + (customer.paymentTerms === 'net60' ? 60 : customer.paymentTerms === 'dueOnReceipt' ? 0 : 30) * day),
        currency: 'EUR', subtotal: Math.round(subtotal * 100) / 100, taxAmount: tax, totalAmount: total,
        amountPaid, balanceDue: Math.round((total - amountPaid) * 100) / 100,
        notes: `Delivery batch for ${customer.companyName}`, isRecurring: ci === 1, recurrence: ci === 1 ? 'monthly' : null,
        periodStart: at(-35), periodEnd: at(-1), createdAt: issueDate,
      },
    });
    invSeq++;
    for (const o of custOrders) {
      const amount = Number(o.chargeAmount || 0);
      await prisma.invoiceLine.create({ data: { invoiceId: invoice.id, orderId: o.id, type: 'DELIVERY_FEE', description: `Delivery ${o.orderNumber}`, quantity: 1, unitPrice: amount, amount } });
    }
    await prisma.invoiceLine.create({ data: { invoiceId: invoice.id, type: 'FUEL_SURCHARGE', description: 'Fuel surcharge', quantity: 1, unitPrice: Math.round(subtotal * 0.08 * 100) / 100, amount: Math.round(subtotal * 0.08 * 100) / 100 } });

    if (amountPaid > 0) {
      await prisma.payment.create({ data: { organizationId: org.id, invoiceId: invoice.id, amount: amountPaid, currency: 'EUR', method: status === 'PAID' ? 'BANK_TRANSFER' : 'ONLINE', status: 'COMPLETED', reference: `PAY-${invSeq}-${Date.now().toString().slice(-6)}`, paidAt: new Date(issueDate.getTime() + 10 * day), recordedBy: users.staff.FINANCE_MANAGER.id } });
    }
    if (ci === 2) {
      const cn = Math.round(invoice.subtotal * 0.1 * 100) / 100;
      await prisma.creditNote.create({ data: { organizationId: org.id, invoiceId: invoice.id, number: cnNo(1), amount: cn, reason: 'Goodwill — SLA miss on order', issuedAt: at(-5) } });
    }
  }

  // ─── Notifications & Preferences ────────────────────────────────────────────
  console.log('   🔔 notifications…');
  await prisma.notification.createMany({ data: [
    { organizationId: org.id, userId: users.staff.DISPATCHER.id, type: 'NEW_ORDER', channel: 'IN_APP', title: 'New order received', body: `Order ${orders[6]?.orderNumber} confirmed`, payload: { orderId: orders[6]?.id }, createdAt: at(-0.5) },
    { organizationId: org.id, userId: drivers[0].userId, type: 'ASSIGNMENT', channel: 'PUSH', title: 'New assignment', body: 'You have a new delivery route', payload: { routeId: route.id }, createdAt: at(-0.4) },
    { organizationId: org.id, userId: users.staff.COMPLIANCE_OFFICER.id, type: 'DOCUMENT_EXPIRY', channel: 'EMAIL', title: 'Document expiring soon', body: 'Registration for UTR-V-202 expires in 6 days', isRead: false, payload: { vehicleId: vehicles[3].id }, createdAt: at(-0.2) },
    { organizationId: org.id, userId: users.staff.FINANCE_MANAGER.id, type: 'INVOICE_PAID', channel: 'IN_APP', title: 'Invoice paid', body: `${customers[0].companyName} settled their invoice`, payload: {}, isRead: true, readAt: at(-0.1), createdAt: at(-0.3) },
    { organizationId: org.id, userId: drivers[2].userId, type: 'SPEED_VIOLATION', channel: 'PUSH', title: 'Speed violation', body: 'Exceeded 90 km/h threshold', payload: { vehicleId: vehicles[2].id, speed: 118 }, createdAt: at(-0.15) },
    { organizationId: org.id, userId: users.staff.ORG_ADMIN.id, type: 'GEOFENCE_BREACH', channel: 'IN_APP', title: 'Geofence exit', body: 'RTM-V-101 left Rotterdam DC Zone', payload: { geofenceId: gf.id, vehicleId: vehicles[0].id }, createdAt: at(-0.3) },
  ] });
  for (const u of [users.staff.ORG_ADMIN, driverUsers[0]]) {
    await prisma.notificationPreference.createMany({
      data: ['NEW_ORDER', 'ASSIGNMENT', 'DELIVERY_COMPLETED', 'DOCUMENT_EXPIRY'].map((t) => ({ userId: u.id, type: t, inApp: true, email: t === 'DOCUMENT_EXPIRY', push: true, webPush: false })),
    });
  }
  await prisma.driverMessage.createMany({ data: [
    { driverId: drivers[0].id, senderId: users.staff.DISPATCHER.id, receiverId: drivers[0].userId, orderId: orders[2]?.id, body: 'Customer asked to arrive before 12:00 if possible.', isFromDriver: false },
    { driverId: drivers[0].id, senderId: drivers[0].userId, receiverId: users.staff.DISPATCHER.id, body: 'Copy, will try. Traffic is light.', isFromDriver: true, isRead: true },
  ] });

  // ─── Analytics, Reports, AI, Audit ──────────────────────────────────────────
  console.log('   📊 analytics, reports, AI & audit…');
  const revenue = orders.filter((o) => ['DELIVERED', 'RETURNED'].includes(o.status)).reduce((s, o) => s + Number(o.chargeAmount || 0), 0);
  await prisma.analyticsSnapshot.createMany({ data: [
    { organizationId: org.id, scope: 'daily', periodStart: at(-1), periodEnd: at(0), metrics: { ordersTotal: 12, onTimeRate: 86.5, revenue: Math.round(revenue * 100) / 100, fuelCost: 640, utilization: 72 } },
    { organizationId: org.id, scope: 'weekly', periodStart: at(-7), periodEnd: at(0), metrics: { ordersTotal: 78, onTimeRate: 88.2, revenue: Math.round(revenue * 6 * 100) / 100, fuelCost: 4200, utilization: 69 } },
  ] });
  await prisma.scheduledReport.createMany({ data: [
    { organizationId: org.id, name: 'Weekly Ops Summary', type: 'delivery_performance', frequency: 'weekly', recipients: [users.staff.ORG_ADMIN.email], format: 'pdf', nextRunAt: at(2), cronExpression: '0 7 * * 1' },
    { organizationId: org.id, name: 'Monthly Revenue', type: 'revenue', frequency: 'monthly', recipients: [users.staff.FINANCE_MANAGER.email], format: 'xlsx', nextRunAt: at(10), cronExpression: '0 7 1 * *' },
  ] });
  await prisma.aiUsageLog.createMany({ data: [
    { organizationId: org.id, userId: users.staff.OPS_MANAGER.id, feature: 'route_optimizer', model: 'openai/gpt-4o', promptTokens: 1420, completionTokens: 380, totalTokens: 1800, estimatedCostUsd: 0.031, latencyMs: 4200, success: true, createdAt: at(-1) },
    { organizationId: org.id, userId: users.staff.OPS_MANAGER.id, feature: 'demand_forecast', model: 'openai/gpt-4o', promptTokens: 900, completionTokens: 500, totalTokens: 1400, estimatedCostUsd: 0.018, latencyMs: 3100, success: true, createdAt: at(-2) },
    { organizationId: org.id, userId: users.staff.FINANCE_MANAGER.id, feature: 'churn_predictor', model: 'openai/gpt-4o', promptTokens: 1100, completionTokens: 400, totalTokens: 1500, estimatedCostUsd: 0.02, latencyMs: 2600, success: false, errorMessage: 'timeout upstream', createdAt: at(-3) },
  ] });
  await prisma.auditLog.createMany({ data: [
    { organizationId: org.id, userId: users.staff.ORG_ADMIN.id, action: 'LOGIN', entityType: 'User', entityId: users.staff.ORG_ADMIN.id, ipAddress: '10.0.0.5', createdAt: at(-1) },
    { organizationId: org.id, userId: users.staff.OPS_MANAGER.id, action: 'CREATE', entityType: 'Order', entityId: orders[6]?.id, after: { orderNumber: orders[6]?.orderNumber }, createdAt: at(-0.5) },
    { organizationId: org.id, userId: users.staff.FINANCE_MANAGER.id, action: 'APPROVE', entityType: 'Invoice', entityId: invNo(1), createdAt: at(-0.2) },
    { organizationId: org.id, userId: users.staff.COMPLIANCE_OFFICER.id, action: 'UPDATE', entityType: 'ComplianceDocument', entityId: docs[0]?.id, before: { status: 'PENDING_REVIEW' }, after: { status: 'APPROVED' }, createdAt: at(-0.4) },
    { userId: superAdminId(users), action: 'UPDATE', entityType: 'Organization', entityId: org.id, before: { subscriptionTier: 'PROFESSIONAL' }, after: { subscriptionTier: 'BUSINESS' }, createdAt: at(-120) },
  ] });

  console.log('   (part 2 done)');
};

function ymdSafe() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
function superAdminId(users) {
  return users.superAdmin ? users.superAdmin.id : null;
}
