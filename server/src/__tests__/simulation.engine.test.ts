import { describe, expect, it } from "vitest";
import {
  computeActionImpactOnScenario,
  simulateActionOnScenarioStates,
} from "../simulator/SimulationEngine";
import type { OperationalState, Scenario } from "../types/dto";

function makeState(): OperationalState {
  return {
    hubIds: ["hub-a", "hub-b", "hub-c"],
    timeRange: {
      startTime: new Date("2026-11-22T08:00:00.000Z"),
      endTime: new Date("2026-11-22T10:00:00.000Z"),
    },
    hubs: [
      {
        id: "hub-a",
        name: "Ga Metro ĐHQG",
        location: "Cổng ĐHQG",
        totalVehicles: 10,
        availableVehicles: 0, // 0 xe khả dụng ban đầu để test ADD_VEHICLES + điều chuyển
        totalSlots: 20,
        freeSlots: 10,
        totalChargingPorts: 4,
        freeChargingPorts: 3, // 3 cổng rảnh
        inUseChargingPorts: 0, // 0 cổng đang dùng, 1 cổng OUT_OF_SERVICE
        averageBattery: 70,
        lastUpdatedAt: "2026-11-22T08:00:00.000Z",
      },
      {
        id: "hub-b",
        name: "ĐH Bách Khoa",
        location: "Dĩ An",
        totalVehicles: 10,
        availableVehicles: 6,
        totalSlots: 20,
        freeSlots: 12,
        totalChargingPorts: 4,
        freeChargingPorts: 1, // 1 rảnh, 2 IN_USE, 1 OUT_OF_SERVICE
        inUseChargingPorts: 2,
        averageBattery: 65,
        lastUpdatedAt: "2026-11-22T08:00:00.000Z",
      },
      {
        id: "hub-c",
        name: "Thư viện Trung tâm",
        location: "ĐHQG",
        totalVehicles: 10,
        availableVehicles: 2,
        totalSlots: 20,
        freeSlots: 8,
        totalChargingPorts: 4,
        freeChargingPorts: 1,
        inUseChargingPorts: 2,
        averageBattery: 45,
        lastUpdatedAt: "2026-11-22T08:00:00.000Z",
      },
    ],
  };
}

describe("SimulationEngine.computeActionImpactOnScenario", () => {
  it("does not count OUT_OF_SERVICE or newly added chargers as IN_USE charging sessions (3 free + 1 faulty + 0 IN_USE)", () => {
    const state = makeState();
    const surge: Scenario = {
      scenarioDraftId: "draft-faulty-port",
      snapshotId: "snap-1",
      scenarioType: "DEMAND_SURGE",
      assumptions: { hubId: "hub-a", demandMultiplier: 2.0 },
    };

    // hub-a: 4 total, 3 free, 1 OUT_OF_SERVICE, 0 IN_USE
    const res = computeActionImpactOnScenario("run-1", "snap-1", state, surge, {
      actionType: "PRIORITIZE_LOW_BATTERY_CHARGING",
      hubId: "hub-a",
      priorityTurnaroundVehicles: 2,
    });
    expect(res.appliedParams.priorityTurnaroundVehicles).toBe(0);
    expect(res.afterAction).toEqual(res.beforeAction);
    expect(res.unavailableKpis.some((m) => m.includes("0 cổng sạc đang sử dụng"))).toBe(true);

    // Even after ADD_CHARGERS (+2) on hub-a, new ports are NOT active IN_USE sessions
    const addChargers: Scenario = {
      scenarioDraftId: "draft-add-chargers",
      snapshotId: "snap-1",
      scenarioType: "ADD_CHARGERS",
      assumptions: { hubId: "hub-a", additionalChargers: 2 },
    };
    const resAdded = computeActionImpactOnScenario("run-1b", "snap-1", state, addChargers, {
      actionType: "PRIORITIZE_LOW_BATTERY_CHARGING",
      hubId: "hub-a",
      priorityTurnaroundVehicles: 2,
    });
    expect(resAdded.appliedParams.priorityTurnaroundVehicles).toBe(0);
    expect(resAdded.afterAction).toEqual(resAdded.beforeAction);
  });

  it("bounds charging turnaround strictly by real IN_USE ports (excluding OUT_OF_SERVICE)", () => {
    const state = makeState();
    const surge: Scenario = {
      scenarioDraftId: "draft-in-use",
      snapshotId: "snap-1",
      scenarioType: "DEMAND_SURGE",
      assumptions: { hubId: "hub-b", demandMultiplier: 2.0 },
    };

    // hub-b has 4 total, 1 free, 2 IN_USE, 1 OUT_OF_SERVICE -> max turnaround must be 2 (NOT 3!)
    const res = computeActionImpactOnScenario("run-2", "snap-1", state, surge, {
      actionType: "PRIORITIZE_LOW_BATTERY_CHARGING",
      hubId: "hub-b",
      priorityTurnaroundVehicles: 5,
    });
    expect(res.appliedParams.priorityTurnaroundVehicles).toBe(2);
    expect(res.afterAction.waitingTimeMinutes).toBeLessThan(res.beforeAction.waitingTimeMinutes);
    expect(res.unavailableKpis.length).toBeGreaterThan(0);
  });

  it("handles legacy snapshots missing inUseChargingPorts gracefully without fabricating KPI change", () => {
    const legacyState = makeState();
    for (const h of legacyState.hubs) {
      delete h.inUseChargingPorts;
    }
    const surge: Scenario = {
      scenarioDraftId: "draft-legacy",
      snapshotId: "snap-legacy",
      scenarioType: "DEMAND_SURGE",
      assumptions: { hubId: "hub-b", demandMultiplier: 2.0 },
    };

    const res = computeActionImpactOnScenario("run-legacy", "snap-legacy", legacyState, surge, {
      actionType: "PRIORITIZE_LOW_BATTERY_CHARGING",
      hubId: "hub-b",
      priorityTurnaroundVehicles: 2,
    });
    expect(res.appliedParams.priorityTurnaroundVehicles).toBe(0);
    expect(res.afterAction).toEqual(res.beforeAction);
    expect(res.unavailableKpis.some((m) => m.includes("Bản chụp cũ"))).toBe(true);
  });

  it("does not double-count vehicles when ADD_VEHICLES (+4 on Hub A with 0 avail) is followed by moving 4 from A to B", () => {
    const state = makeState();
    const addVehicles: Scenario = {
      scenarioDraftId: "draft-add-veh",
      snapshotId: "snap-1",
      scenarioType: "ADD_VEHICLES",
      assumptions: { hubId: "hub-a", additionalVehicles: 4 },
    };

    const exec = simulateActionOnScenarioStates("run-3", "snap-1", state, addVehicles, {
      actionType: "REDISTRIBUTE_VEHICLES",
      sourceHubId: "hub-a",
      targetHubId: "hub-b",
      vehicleCount: 4,
    });

    const beforeA = exec.beforeHubs.find((h) => h.id === "hub-a")!;
    const beforeB = exec.beforeHubs.find((h) => h.id === "hub-b")!;
    const afterA = exec.afterHubs.find((h) => h.id === "hub-a")!;
    const afterB = exec.afterHubs.find((h) => h.id === "hub-b")!;

    // Sau kịch bản (trước điều chuyển): A có đúng 4 xe, B có 6 xe
    expect(beforeA.availableVehicles).toBe(4);
    expect(beforeB.availableVehicles).toBe(6);

    // Sau điều chuyển 4 xe A -> B: A còn đúng 0, B tăng đúng 4 thành 10 (không tính trùng ở A!)
    expect(exec.result.appliedParams.vehicleCount).toBe(4);
    expect(afterA.availableVehicles).toBe(0);
    expect(afterB.availableVehicles).toBe(10);

    // Bảo toàn tổng số xe khả dụng & tổng số xe trước/sau hành động
    const totalAvailBefore = exec.beforeHubs.reduce((s, h) => s + h.availableVehicles, 0);
    const totalAvailAfter = exec.afterHubs.reduce((s, h) => s + h.availableVehicles, 0);
    const totalFleetBefore = exec.beforeHubs.reduce((s, h) => s + h.totalVehicles, 0);
    const totalFleetAfter = exec.afterHubs.reduce((s, h) => s + h.totalVehicles, 0);
    expect(totalAvailAfter).toBe(totalAvailBefore);
    expect(totalFleetAfter).toBe(totalFleetBefore);
  });

  it("rejects redistributing vehicles into/from a Hub closed by HUB_CLOSURE and rejects charging priority on closed Hub", () => {
    const state = makeState();
    const closure: Scenario = {
      scenarioDraftId: "draft-closure",
      snapshotId: "snap-1",
      scenarioType: "HUB_CLOSURE",
      assumptions: { hubId: "hub-c" },
    };

    const intoClosed = computeActionImpactOnScenario("run-4a", "snap-1", state, closure, {
      actionType: "REDISTRIBUTE_VEHICLES",
      sourceHubId: "hub-b",
      targetHubId: "hub-c",
      vehicleCount: 3,
    });
    expect(intoClosed.appliedParams.vehicleCount).toBe(0);
    expect(intoClosed.afterAction).toEqual(intoClosed.beforeAction);
    expect(intoClosed.unavailableKpis.some((m) => m.includes("đóng cửa"))).toBe(true);

    const fromClosed = computeActionImpactOnScenario("run-4b", "snap-1", state, closure, {
      actionType: "REDISTRIBUTE_VEHICLES",
      sourceHubId: "hub-c",
      targetHubId: "hub-b",
      vehicleCount: 2,
    });
    expect(fromClosed.appliedParams.vehicleCount).toBe(0);
    expect(fromClosed.afterAction).toEqual(fromClosed.beforeAction);
    expect(fromClosed.unavailableKpis.some((m) => m.includes("đóng cửa"))).toBe(true);

    const closedCharge = computeActionImpactOnScenario("run-4c", "snap-1", state, closure, {
      actionType: "PRIORITIZE_LOW_BATTERY_CHARGING",
      hubId: "hub-c",
      priorityTurnaroundVehicles: 2,
    });
    expect(closedCharge.appliedParams.priorityTurnaroundVehicles).toBe(0);
    expect(closedCharge.afterAction).toEqual(closedCharge.beforeAction);
    expect(closedCharge.unavailableKpis.some((m) => m.includes("đóng cửa"))).toBe(true);
  });
});
