// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
import type { SharedVehicle } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";
import type { SearchCriteria } from "../services/SearchService";

export const searchRepository = {
  /** Lấy xe/chỗ/cổng ứng viên theo tiêu chí (chưa xếp hạng). */
  findCandidateVehicles(criteria: SearchCriteria): SharedVehicle[] {
    throw notImplemented("SearchRepository.findCandidateVehicles (UC01)");
  },
};
