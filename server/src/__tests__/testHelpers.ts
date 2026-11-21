import bcrypt from "bcryptjs";
import {
  alerts,
  chargingPorts,
  chargingRequests,
  chargingReservations,
  chargingScheduleVersions,
  chargingSessions,
  hubs,
  incidents,
  parkingAllocations,
  parkingSlots,
  privateVehicles,
  processedRequests,
  redistributionItems,
  redistributionOrders,
  sharedVehicles,
  simulationRuns,
  simulationSnapshots,
  trips,
  users,
  vehicleReservations,
} from "../db/schema";
import { db } from "../lib/db";

/** Xóa sạch dữ liệu trong DB test theo đúng thứ tự khóa ngoại (không ảnh hưởng dev.db). */
export function resetTestData(): void {
  db.delete(processedRequests).run();
  db.delete(simulationRuns).run();
  db.delete(simulationSnapshots).run();
  db.delete(chargingScheduleVersions).run();
  db.delete(redistributionItems).run();
  db.delete(redistributionOrders).run();
  db.delete(alerts).run();
  db.delete(incidents).run();
  db.delete(chargingSessions).run();
  db.delete(chargingReservations).run();
  db.delete(chargingRequests).run();
  db.delete(parkingAllocations).run();
  db.delete(trips).run();
  db.delete(vehicleReservations).run();
  db.delete(privateVehicles).run();
  db.delete(sharedVehicles).run();
  db.delete(chargingPorts).run();
  db.delete(parkingSlots).run();
  db.delete(hubs).run();
  db.delete(users).run();
}

export interface TestFixtures {
  student1Id: string;
  student2Id: string;
  operatorId: string;
  hubId: string;
  regularSlotId: string;
  chargerSlotId: string;
  vehicleReadyId: string;
  vehicleLowBatteryId: string;
  privateVehicle1Id: string;
}

export function seedBasicFixtures(): TestFixtures {
  resetTestData();

  const passwordHash = bcrypt.hashSync("password123", 4);
  const student1 = db
    .insert(users)
    .values({ email: "sv1@test.local", passwordHash, fullName: "Sinh viên 1", role: "STUDENT" })
    .returning()
    .get();
  const student2 = db
    .insert(users)
    .values({ email: "sv2@test.local", passwordHash, fullName: "Sinh viên 2", role: "STUDENT" })
    .returning()
    .get();
  const operator = db
    .insert(users)
    .values({ email: "op@test.local", passwordHash, fullName: "Vận hành 1", role: "OPERATOR" })
    .returning()
    .get();

  const hub = db
    .insert(hubs)
    .values({ name: "Hub KTX Khu A", location: "ĐHQG-HCM" })
    .returning()
    .get();

  const occupiedSlot = db
    .insert(parkingSlots)
    .values({ hubId: hub.id, code: "A-01", hasCharger: false, status: "IN_SERVICE" })
    .returning()
    .get();
  const freeSlot = db
    .insert(parkingSlots)
    .values({ hubId: hub.id, code: "A-02", hasCharger: false, status: "IN_SERVICE" })
    .returning()
    .get();
  const chargerSlot = db
    .insert(parkingSlots)
    .values({ hubId: hub.id, code: "A-C1", hasCharger: true, status: "IN_SERVICE" })
    .returning()
    .get();

  db.insert(chargingPorts)
    .values({ slotId: chargerSlot.id, connectorType: "TYPE_2", maxPowerKw: 7.4, status: "AVAILABLE" })
    .run();

  const vehicleReady = db
    .insert(sharedVehicles)
    .values({
      code: "EV-TEST-01",
      type: "E_BIKE",
      batteryLevel: 85,
      status: "AVAILABLE",
      hubId: hub.id,
      slotId: occupiedSlot.id,
    })
    .returning()
    .get();

  const vehicleLowBattery = db
    .insert(sharedVehicles)
    .values({
      code: "EV-TEST-LOW",
      type: "E_BIKE",
      batteryLevel: 10,
      status: "AVAILABLE",
      hubId: hub.id,
      slotId: null,
    })
    .returning()
    .get();

  const privateVehicle1 = db
    .insert(privateVehicles)
    .values({
      ownerId: student1.id,
      plate: "59-MD1 123.45",
      type: "E_MOTORBIKE",
      connectorType: "TYPE_2",
    })
    .returning()
    .get();

  return {
    student1Id: student1.id,
    student2Id: student2.id,
    operatorId: operator.id,
    hubId: hub.id,
    regularSlotId: freeSlot.id,
    chargerSlotId: chargerSlot.id,
    vehicleReadyId: vehicleReady.id,
    vehicleLowBatteryId: vehicleLowBattery.id,
    privateVehicle1Id: privateVehicle1.id,
  };
}
