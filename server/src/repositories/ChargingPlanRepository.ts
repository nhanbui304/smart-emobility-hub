// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
import type { ChargingPlan } from "../db/schema";
import { db, type DbOrTx, type Tx } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const chargingPlanRepository = {
  findCurrentByHub(hubId: string, conn: DbOrTx = db): ChargingPlan | undefined {
    throw notImplemented("ChargingPlanRepository.findCurrentByHub (UC13)");
  },

  /** UC13 – trong runIdempotent: version hiện tại phải = baseVersion; ghi lịch mới, version + 1. */
  atomicApplyPlan(tx: Tx, input: { hubId: string; payload: unknown; baseVersion: number; now: Date }): ChargingPlan {
    throw notImplemented("ChargingPlanRepository.atomicApplyPlan (UC13)");
  },
};
