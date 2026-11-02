// Owner: Lê Quốc Linh – View Hub and Resource Status (luồng mẫu cho cả nhóm)
import type { Hub } from "../db/schema";
import { AppError } from "../lib/errors";
import { hubRepository } from "../repositories/HubRepository";
import type { HubDetail, HubStatus } from "../types/dto";

/**
 * Service chứa NGHIỆP VỤ: tổng hợp số liệu từ repository thành HubStatus.
 * Không truy cập db trực tiếp, không đọc req/res.
 */
export const hubService = {
  getAllHubStatuses(now: Date = new Date()): HubStatus[] {
    return buildStatuses(hubRepository.findAll(), now);
  },

  getHubDetail(hubId: string, now: Date = new Date()): HubDetail {
    const hub = hubRepository.findById(hubId);
    if (!hub) throw new AppError("NOT_FOUND", "Không tìm thấy Hub.");

    const status = buildStatuses([hub], now)[0]!;
    const vehicles = hubRepository.listVehicles(hubId).map((v) => ({
      id: v.id,
      code: v.code,
      type: v.type,
      batteryLevel: v.batteryLevel,
      status: v.status,
      hubId: v.hubId,
      slotId: v.slotId,
      lastUpdatedAt: v.lastUpdatedAt.toISOString(),
    }));
    return { ...status, vehicles };
  },
};

function buildStatuses(hubs: Hub[], now: Date): HubStatus[] {
  const slots = hubRepository.listSlots();
  const vehicles = hubRepository.listVehicles();
  const ports = hubRepository.listPortsWithHub();
  const allocations = hubRepository.listActiveAllocationsAt(now);

  // Vị trí đang có xe dùng chung đỗ hoặc đang được giữ/đặt thì không còn trống
  const occupiedSlotIds = new Set<string>();
  for (const v of vehicles) if (v.slotId) occupiedSlotIds.add(v.slotId);
  for (const a of allocations) occupiedSlotIds.add(a.slotId);

  return hubs.map((hub) => {
    const hubSlots = slots.filter((s) => s.hubId === hub.id);
    const hubVehicles = vehicles.filter((v) => v.hubId === hub.id);
    const hubPorts = ports.filter((p) => p.hubId === hub.id);
    const totalBattery = hubVehicles.reduce((sum, v) => sum + v.batteryLevel, 0);

    return {
      id: hub.id,
      name: hub.name,
      location: hub.location,
      availableVehicles: hubVehicles.filter((v) => v.status === "AVAILABLE").length,
      totalVehicles: hubVehicles.length,
      freeSlots: hubSlots.filter((s) => s.status === "IN_SERVICE" && !occupiedSlotIds.has(s.id)).length,
      totalSlots: hubSlots.length,
      freeChargingPorts: hubPorts.filter((p) => p.status === "AVAILABLE").length,
      totalChargingPorts: hubPorts.length,
      averageBattery: hubVehicles.length === 0 ? 0 : Math.round(totalBattery / hubVehicles.length),
      lastUpdatedAt: hub.lastUpdatedAt.toISOString(),
    };
  });
}
