// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { SharedVehicle } from "../db/schema";
import type { MobilityContext, OptionState, SearchCriteria } from "../types/dto";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const mobilityRepository = {
  queryMobilityContext(criteria: SearchCriteria): MobilityContext {
    throw notImplemented("MobilityRepository.queryMobilityContext");
  },

  queryCurrentOptionState(optionId: string): OptionState {
    throw notImplemented("MobilityRepository.queryCurrentOptionState");
  },

  /** Lấy xe/chỗ/cổng ứng viên theo tiêu chí (chưa xếp hạng). */
  findCandidateVehicles(criteria: SearchCriteria): SharedVehicle[] {
    throw notImplemented("MobilityRepository.findCandidateVehicles");
  },
};
