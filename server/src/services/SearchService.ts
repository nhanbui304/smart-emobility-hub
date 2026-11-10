// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Chữ ký method theo Sequence Submission #2 (Hình 2.1–2.2).
import type { VehicleType } from "../constants";
import type { ChargingPort, Hub, ParkingSlot, SharedVehicle } from "../db/schema";
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

/** Dữ liệu vận hành để lọc phương án (UC01 bước 3: queryMobilityContext → mobilityContext). */
export interface MobilityContext {
  hubs: Hub[];
  vehicles: SharedVehicle[];
  slots: ParkingSlot[];
  ports: Array<ChargingPort & { hubId: string }>;
  /** Thời điểm cập nhật mới nhất của từng Hub, dùng cho assessDataFreshness. */
  hubUpdatedAt: Record<string, Date>;
  capturedAt: Date;
}

export interface MobilityOption {
  optionId: string;
  hubId: string;
  hubName: string;
  availableCount: number;
  /** Tài nguyên có dữ liệu cũ / chưa xác minh (Ext 3b): vẫn hiển thị nhưng đánh dấu. */
  isUnverified: boolean;
  note?: string;
}

/** UC01 bước 4: searchResult(options, updatedAt, unverifiedFlags). */
export interface SearchResult {
  sessionId: string;
  options: MobilityOption[];
  updatedAt: Date;
  /** optionId của các phương án chưa xác minh. */
  unverifiedFlags: string[];
}

/** UC01 bước 6: chọn phương án. */
export interface OptionSelectionResult {
  /** SELECTED: phương án còn hợp lệ · OPTION_CHANGED: tình trạng đã đổi, trả kết quả cập nhật (Ext 6a). */
  status: "SELECTED" | "OPTION_CHANGED";
  option?: MobilityOption;
  /** Nghiệp vụ tiếp theo có thể mở: UC02 đặt xe, UC06 đặt chỗ đỗ, UC07/UC08 sạc. */
  nextActions: Array<"UC02" | "UC06" | "UC07" | "UC08">;
  updatedSearchResult?: SearchResult;
}

export const searchService = {
  /**
   * UC01 bước 2–4: kiểm tra tiêu chí (validateCriteria; thiếu / sai → VALIDATION_ERROR, Ext 2a),
   * đọc dữ liệu vận hành (queryMobilityContext), đánh giá độ mới (assessDataFreshness),
   * đánh dấu tài nguyên chưa xác minh (markUnverifiedResources), lọc (filterSuitableOptions);
   * lưu phiên tìm kiếm cùng tiêu chí. Không có phương án phù hợp → options rỗng kèm gợi ý (Ext 4a).
   */
  async findSuitableOptions(studentId: string, criteria: SearchCriteria): Promise<SearchResult> {
    throw notImplemented("SearchService.findSuitableOptions (UC01)");
  },

  /** UC01 bước 4 (self-call trong sequence): lọc và xếp hạng phương án từ dữ liệu vận hành. */
  filterSuitableOptions(criteria: SearchCriteria, mobilityContext: MobilityContext): MobilityOption[] {
    throw notImplemented("SearchService.filterSuitableOptions (UC01)");
  },

  /**
   * UC01 bước 5–6: tra tiêu chí của phiên, kiểm tra lại phương án (validateSelectedOption →
   * queryCurrentOptionState), ghi nhận lựa chọn (recordSessionSelection), trả nghiệp vụ tiếp theo.
   */
  async confirmOptionSelection(studentId: string, sessionId: string, optionId: string): Promise<OptionSelectionResult> {
    throw notImplemented("SearchService.confirmOptionSelection (UC01)");
  },
};
