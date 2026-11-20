/**
 * Dữ liệu mẫu theo hồ sơ kiểm thử của nhóm: 5 Hub, 100 vị trí đỗ (20 có cổng sạc), 50 xe dùng chung.
 * Dùng bộ sinh số ngẫu nhiên có seed cố định → mỗi lần `npm run db:reset` ra CÙNG một dữ liệu.
 *
 * Chạy: npm run db:seed (xóa dữ liệu cũ trong các bảng rồi tạo lại)
 */
import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { closeDb, db } from "../lib/db";
import * as s from "./schema";

/** Mulberry32 – sinh số ngẫu nhiên có seed. */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seededRandom(17);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const HUBS = [
  { code: "MET", name: "Ga Metro ĐHQG", location: "Ga Metro Bến Thành – Suối Tiên, cổng ĐHQG" },
  { code: "KTB", name: "KTX Khu B", location: "Ký túc xá Khu B, ĐHQG-HCM" },
  { code: "BKU", name: "ĐH Bách Khoa", location: "Cơ sở Dĩ An, Trường ĐH Bách Khoa" },
  { code: "KHT", name: "ĐH KHTN", location: "Cơ sở Linh Trung, Trường ĐH Khoa học Tự nhiên" },
  { code: "TVT", name: "Thư viện Trung tâm", location: "Thư viện Trung tâm ĐHQG-HCM" },
];
const SLOTS_PER_HUB = 20;
const CHARGERS_PER_HUB = 4;
const VEHICLES_PER_HUB = 10;

async function main() {
  const now = new Date();
  const [operatorHash, studentHash] = await Promise.all([
    bcrypt.hash("operator123", 10),
    bcrypt.hash("student123", 10),
  ]);

  db.transaction(() => {
    // Xóa dữ liệu cũ (con trước, cha sau để không vướng khóa ngoại)
    for (const table of [
      s.processedRequests,
      s.simulationRuns,
      s.simulationSnapshots,
      s.chargingScheduleVersions,
      s.redistributionItems,
      s.redistributionOrders,
      s.alerts,
      s.incidents,
      s.chargingSessions,
      s.chargingReservations,
      s.chargingRequests,
      s.parkingAllocations,
      s.trips,
      s.vehicleReservations,
      s.privateVehicles,
      s.sharedVehicles,
      s.chargingPorts,
      s.parkingSlots,
      s.hubs,
      s.users,
    ]) {
      db.delete(table).run();
    }

    // Tài khoản demo
    db.insert(s.users)
      .values({
        email: "operator@hub.local",
        passwordHash: operatorHash,
        fullName: "Nhân viên vận hành",
        role: "OPERATOR",
      })
      .run();
    const students = [
      { email: "student1@hub.local", fullName: "Nguyễn Văn An", plate: "59-X1 123.45" },
      { email: "student2@hub.local", fullName: "Trần Thị Bình", plate: "59-X2 678.90" },
    ];
    for (const st of students) {
      const user = db
        .insert(s.users)
        .values({ email: st.email, passwordHash: studentHash, fullName: st.fullName, role: "STUDENT" })
        .returning()
        .get();
      db.insert(s.privateVehicles)
        .values({
          ownerId: user.id,
          plate: st.plate,
          type: "E_MOTORBIKE",
          connectorType: "STANDARD_PLUG",
        })
        .run();
    }

    // Hub, vị trí đỗ, cổng sạc, xe
    let vehicleNo = 1;
    for (const h of HUBS) {
      const hub = db
        .insert(s.hubs)
        .values({ name: h.name, location: h.location, lastUpdatedAt: now })
        .returning()
        .get();

      const slots = [];
      for (let i = 1; i <= SLOTS_PER_HUB; i++) {
        const hasCharger = i > SLOTS_PER_HUB - CHARGERS_PER_HUB; // 4 vị trí cuối có cổng sạc
        const slot = db
          .insert(s.parkingSlots)
          .values({
            hubId: hub.id,
            code: `${h.code}-${String(i).padStart(2, "0")}`,
            hasCharger,
            status: "IN_SERVICE",
          })
          .returning()
          .get();
        slots.push(slot);
        if (hasCharger) {
          db.insert(s.chargingPorts)
            .values({
              slotId: slot.id,
              connectorType: i % 2 === 0 ? "TYPE_2" : "STANDARD_PLUG",
              maxPowerKw: i % 2 === 0 ? 7.4 : 3.6,
              status: "AVAILABLE",
            })
            .run();
        }
      }

      // 10 xe mỗi Hub: 8 xe đỗ ở vị trí thường, 2 xe cuối đỗ ở vị trí có sạc
      const normalSlots = slots.filter((sl) => !sl.hasCharger);
      const chargerSlots = slots.filter((sl) => sl.hasCharger);
      for (let i = 0; i < VEHICLES_PER_HUB; i++) {
        const onCharger = i >= VEHICLES_PER_HUB - 2;
        const slot = onCharger ? chargerSlots[i - (VEHICLES_PER_HUB - 2)]! : normalSlots[i]!;
        const roll = rand();
        const status = onCharger ? "CHARGING" : roll < 0.08 ? "UNDER_MAINTENANCE" : "AVAILABLE";
        const type = rand() < 0.6 ? "E_BIKE" : "E_MOTORBIKE";
        db.insert(s.sharedVehicles)
          .values({
            code: `${type === "E_BIKE" ? "EB" : "EM"}-${String(vehicleNo++).padStart(3, "0")}`,
            type,
            batteryLevel: onCharger ? randInt(10, 40) : randInt(10, 100),
            status,
            hubId: hub.id,
            slotId: slot.id,
            lastUpdatedAt: now,
          })
          .run();
        if (onCharger) {
          // Cổng sạc đang được xe dùng chung sử dụng
          const port = db
            .select()
            .from(s.chargingPorts)
            .all()
            .find((p) => p.slotId === slot.id)!;
          db.update(s.chargingPorts).set({ status: "IN_USE" }).where(eq(s.chargingPorts.id, port.id)).run();
        }
      }
    }

    // Lịch mẫu UC09 thuộc tài khoản demo thực sự sở hữu xe.
    const demoChargingStudent = db.select().from(s.users).where(eq(s.users.email, "student1@hub.local")).get()!;
    const demoChargingVehicle = db.select().from(s.privateVehicles)
      .where(eq(s.privateVehicles.ownerId, demoChargingStudent.id)).get()!;
    const demoChargingPort = db.select().from(s.chargingPorts).where(eq(s.chargingPorts.status, "AVAILABLE")).all()
      .find((port) => port.connectorType === demoChargingVehicle.connectorType)!;
    const startTime = new Date(now);
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(10, 0, 0, 0);
    db.insert(s.chargingReservations).values({
      id: "cr-demo-01",
      studentId: demoChargingStudent.id,
      privateVehicleId: demoChargingVehicle.id,
      portId: demoChargingPort.id,
      startTime,
      endTime: new Date(startTime.getTime() + 90 * 60_000),
      currentBattery: 35,
      targetBattery: 90,
      status: "CONFIRMED",
      version: 1,
    }).run();
  });

  const total = (
    table: typeof s.hubs | typeof s.parkingSlots | typeof s.chargingPorts | typeof s.sharedVehicles | typeof s.users,
  ) => db.select({ n: count() }).from(table).get()?.n ?? 0;
  console.log(
    `[seed] Xong: ${total(s.hubs)} Hub, ${total(s.parkingSlots)} vị trí đỗ, ${total(s.chargingPorts)} cổng sạc, ` +
      `${total(s.sharedVehicles)} xe dùng chung, ${total(s.users)} tài khoản.`,
  );
  console.log(
    "[seed] Tài khoản: operator@hub.local / operator123 · student1@hub.local, student2@hub.local / student123",
  );
}

main()
  .catch((err) => {
    console.error("[seed] Lỗi:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
