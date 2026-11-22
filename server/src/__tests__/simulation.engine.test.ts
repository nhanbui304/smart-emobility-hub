import { describe, expect, it } from "vitest";
import { computeActionImpactOnScenario } from "../simulator/SimulationEngine";
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
        availableVehicles: 5,
        totalSlots: 20,
        freeSlots: 10,
        totalChargingPorts: 4,
        freeChargingPorts: 4, // cả 4 cổng đều rảnh
        averageBattery: 70,
        lastUpdatedAt: "2026-11-22T08:00:00.000Z",
      },
      {
        id: "hub-b",
        name: "ĐH Bách Khoa",
        location: "Dĩ An",
        totalVehicles: 10,
        availableVehicles: 8,
        totalSlots: 20,
        freeSlots: 12,
        totalChargingPorts: 4,
        freeChargingPorts: 2, // 2 cổng đang bận
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
        freeChargingPorts: 1, // 3 cổng đang bận
        averageBattery: 45,
        lastUpdatedAt: "2026-11-22T08:00:00.000Z",
      },
    ],
  };
}

describe("SimulationEngine.computeActionImpactOnScenario", () => {
  it("rejects redistributing vehicles into or from a Hub closed by HUB_CLOSURE scenario", () => {
    const state = makeState();
    const scenario: Scenario = {
      scenarioDraftId: "draft-1",
      snapshotId: "snap-1",
      scenarioType: "HUB_CLOSURE",
      assumptions: { hubId: "hub-c" },
    };

    const intoClosed = computeActionImpactOnScenario("run-1", "snap-1", state, scenario, {
      actionType: "REDISTRIBUTE_VEHICLES",
      sourceHubId: "hub-b",
      targetHubId: "hub-c",
      vehicleCount: 3,
    });
    expect(intoClosed.appliedParams.vehicleCount).toBe(0);
    expect(intoClosed.afterAction).toEqual(intoClosed.beforeAction);
    expect(intoClosed.unavailableKpis.some((m) => m.includes("đóng cửa"))).toBe(true);

    const fromClosed = computeActionImpactOnScenario("run-1", "snap-1", state, scenario, {
      actionType: "REDISTRIBUTE_VEHICLES",
      sourceHubId: "hub-c",
      targetHubId: "hub-a",
      vehicleCount: 2,
    });
    expect(fromClosed.appliedParams.vehicleCount).toBe(0);
    expect(fromClosed.afterAction).toEqual(fromClosed.beforeAction);
    expect(fromClosed.unavailableKpis.some((m) => m.includes("đóng cửa"))).toBe(true);

    // Default target/source selection skips closed hub-c
    const autoSelect = computeActionImpactOnScenario("run-1", "snap-1", state, scenario, {
      actionType: "REDISTRIBUTE_VEHICLES",
      vehicleCount: 2,
    });
    expect(autoSelect.appliedParams.sourceHubId).not.toBe("hub-c");
    expect(autoSelect.appliedParams.targetHubId).not.toBe("hub-c");
    expect(autoSelect.appliedParams.vehicleCount).toBe(2);
  });

  it("reports insufficient data instead of reducing waiting time when all charging ports at the Hub are free", () => {
    const state = makeState();
    const scenario: Scenario = {
      scenarioDraftId: "draft-2",
      snapshotId: "snap-1",
      scenarioType: "DEMAND_SURGE",
      assumptions: { hubId: "hub-a", demandMultiplier: 2.0 },
    };

    // hub-a has 4/4 free charging ports (0 busy ports), even though 5 vehicles are unavailable (in use/maintenance)
    const res = computeActionImpactOnScenario("run-2", "snap-1", state, scenario, {
      actionType: "PRIORITIZE_LOW_BATTERY_CHARGING",
      hubId: "hub-a",
      priorityTurnaroundVehicles: 2,
    });

    expect(res.appliedParams.priorityTurnaroundVehicles).toBe(0);
    expect(res.afterAction).toEqual(res.beforeAction);
    expect(res.unavailableKpis.some((m) => m.includes("đều đang rảnh") || m.includes("0 cổng đang bận"))).toBe(true);
  });

  it("bounds charging turnaround strictly by occupied ports and rejects closed Hubs", () => {
    const state = makeState();
    const surge: Scenario = {
      scenarioDraftId: "draft-3",
      snapshotId: "snap-1",
      scenarioType: "DEMAND_SURGE",
      assumptions: { hubId: "hub-b", demandMultiplier: 2.0 },
    };

    // hub-b has 2 busy ports (4 total, 2 free) and 2 unavailable vehicles
    const valid = computeActionImpactOnScenario("run-3", "snap-1", state, surge, {
      actionType: "PRIORITIZE_LOW_BATTERY_CHARGING",
      hubId: "hub-b",
      priorityTurnaroundVehicles: 5, // request more than busy ports -> capped to 2
    });
    expect(valid.appliedParams.priorityTurnaroundVehicles).toBe(2);
    expect(valid.afterAction.waitingTimeMinutes).toBeLessThan(valid.beforeAction.waitingTimeMinutes);
    expect(valid.unavailableKpis.length).toBeGreaterThan(0);

    // Closed Hub cannot run charging priority
    const closure: Scenario = {
      scenarioDraftId: "draft-4",
      snapshotId: "snap-1",
      scenarioType: "HUB_CLOSURE",
      assumptions: { hubId: "hub-c" },
    };
    const closedCharge = computeActionImpactOnScenario("run-4", "snap-1", state, closure, {
      actionType: "PRIORITIZE_LOW_BATTERY_CHARGING",
      hubId: "hub-c",
      priorityTurnaroundVehicles: 2,
    });
    expect(closedCharge.appliedParams.priorityTurnaroundVehicles).toBe(0);
    expect(closedCharge.afterAction).toEqual(closedCharge.beforeAction);
    expect(closedCharge.unavailableKpis.some((m) => m.includes("đóng cửa"))).toBe(true);
  });
});
