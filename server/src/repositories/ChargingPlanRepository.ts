// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
import type { ChargingPlan } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const chargingPlanRepository = {
  findCurrentByHub(hubId: string): ChargingPlan | undefined {
    throw notImplemented("ChargingPlanRepository.findCurrentByHub (UC13)");
  },

  /** UC13 – trong db.transaction: version hiện tại phải = baseVersion; ghi lịch mới, version + 1. */
  atomicApplyPlan(input: { hubId: string; payload: unknown; baseVersion: number; now: Date }): ChargingPlan {
    throw notImplemented("ChargingPlanRepository.atomicApplyPlan (UC13)");
  },
};
