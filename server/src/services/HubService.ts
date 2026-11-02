// Owner: Lê Quốc Linh – View Hub and Resource Status (luồng mẫu cho cả nhóm)
import { ChargingPortStatus, SlotStatus, VehicleStatus, type HubDetail, type HubStatus } from "@hub/shared";
import type { Hub } from "../db/schema";
import { AppError, ErrorCode } from "../lib/errors";
import { hubRepository } from "../repositories/HubRepository";

/**
 * Service chứa NGHIỆP VỤ: tổng hợp số liệu từ repository thành HubStatus.
 * Không truy cập db trực tiếp, không đọc req/res.
 */
export const hubService = {
  getAllHubStatuses(now: Date = new Date()): HubStatus[] {
    const hubs = hubRepository.findAll();
    return buildStatuses(hubs, now);
  },

  getHubDetail(hubId: string, now: Date = new Date()): HubDetail {
    const hub = hubRepository.findById(hubId);
    if (!hub) throw new AppError(ErrorCode.NOT_FOUND, "Không tìm thấy Hub.");

    const [status] = buildStatuses([hub], now);
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
    return { ...status!, vehicles };
  },
};

function buildStatuses(hubs: Hub[], now: Date): HubStatus[] {
  const slots = hubRepository.listSlots();
  const vehicles = hubRepository.listVehicles();
  const ports = hubRepository.listPortsWithHub();
  const allocations = hubRepository.listActiveAllocationsAt(now);

  const occupiedSlotIds = new Set<string>([
    ...vehicles.filter((v) => v.slotId).map((v) => v.slotId!),
    ...allocations.map((a) => a.slotId),
  ]);

  return hubs.map((hub) => {
    const hubSlots = slots.filter((s) => s.hubId === hub.id);
    const hubVehicles = vehicles.filter((v) => v.hubId === hub.id);
    const hubPorts = ports.filter((p) => p.hubId === hub.id);
    const avgBattery =
      hubVehicles.length === 0 ? 0 : hubVehicles.reduce((sum, v) => sum + v.batteryLevel, 0) / hubVehicles.length;

    return {
      id: hub.id,
      name: hub.name,
      location: hub.location,
      availableVehicles: hubVehicles.filter((v) => v.status === VehicleStatus.AVAILABLE).length,
      totalVehicles: hubVehicles.length,
      freeSlots: hubSlots.filter((s) => s.status === SlotStatus.IN_SERVICE && !occupiedSlotIds.has(s.id)).length,
      totalSlots: hubSlots.length,
      freeChargingPorts: hubPorts.filter((p) => p.status === ChargingPortStatus.AVAILABLE).length,
      totalChargingPorts: hubPorts.length,
      averageBattery: Math.round(avgBattery),
      lastUpdatedAt: hub.lastUpdatedAt.toISOString(),
    };
  });
}
