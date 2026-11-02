// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
import type { VehicleType } from "@hub/shared";
import { notImplemented } from "../lib/errors";

export interface SearchCriteria {
  /** Mục đích: thuê xe dùng chung, tìm chỗ đỗ, tìm chỗ sạc. */
  purpose: "RENT_VEHICLE" | "PARK" | "CHARGE";
  /** Vị trí hiện tại hoặc Hub mong muốn. */
  originHubId?: string;
  vehicleType?: VehicleType;
  minBattery?: number;
  startTime?: Date;
  endTime?: Date;
}

export interface MobilityOption {
  optionId: string;
  hubId: string;
  hubName: string;
  availableCount: number;
  note?: string;
}

export interface SearchResult {
  sessionId: string;
  options: MobilityOption[];
}

export const searchService = {
  /** UC01 bước 2–4: tìm các Hub/phương án phù hợp với nhu cầu. */
  async findSuitableOptions(criteria: SearchCriteria): Promise<SearchResult> {
    throw notImplemented("SearchService.findSuitableOptions (UC01)");
  },

  /** UC01 luồng thay thế: lọc lại kết quả theo tiêu chí mới trong cùng phiên tìm kiếm. */
  async filterSuitableOptions(criteria: SearchCriteria, context: { sessionId: string }): Promise<SearchResult> {
    throw notImplemented("SearchService.filterSuitableOptions (UC01)");
  },

  /** UC01 bước cuối: sinh viên chọn một phương án → chuyển sang UC02/UC06/UC07/UC08 tương ứng. */
  async confirmOptionSelection(sessionId: string, optionId: string): Promise<MobilityOption> {
    throw notImplemented("SearchService.confirmOptionSelection (UC01)");
  },
};
