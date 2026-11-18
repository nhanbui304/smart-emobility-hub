// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { MobilityContext, MobilityOption, OptionSelectionResult, SearchCriteria, SearchFormConfig, SearchResult } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const searchService = {
  async loadSearchForm(): Promise<SearchFormConfig> {
    throw notImplemented("SearchService.loadSearchForm");
  },

  /** UC01 bước 2–4: tìm các Hub/phương án phù hợp với nhu cầu. */
  async findSuitableOptions(criteria: SearchCriteria): Promise<SearchResult> {
    throw notImplemented("SearchService.findSuitableOptions");
  },

  /** UC01 bước cuối: sinh viên chọn một phương án → chuyển sang UC02/UC06/UC07/UC08 tương ứng. */
  async confirmOptionSelection(sessionId: string, optionId: string): Promise<OptionSelectionResult> {
    throw notImplemented("SearchService.confirmOptionSelection");
  },

  async validateCriteria(criteria: SearchCriteria): Promise<boolean> {
    throw notImplemented("SearchService.validateCriteria");
  },

  async validateSelectedOption(optionId: string, criteria: SearchCriteria): Promise<boolean> {
    throw notImplemented("SearchService.validateSelectedOption");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function assessDataFreshness(context: MobilityContext): void {
  throw notImplemented("SearchService.assessDataFreshness");
}

/** private (–) trong class diagram. */
function markUnverifiedResources(context: MobilityContext): void {
  throw notImplemented("SearchService.markUnverifiedResources");
}

/** private (–) trong class diagram. UC01 luồng thay thế: lọc lại kết quả theo tiêu chí mới trong cùng phiên tìm kiếm. */
function filterSuitableOptions(criteria: SearchCriteria, ctx: MobilityContext): MobilityOption[] {
  throw notImplemented("SearchService.filterSuitableOptions");
}

/** private (–) trong class diagram. */
function recordSessionSelection(sessionId: string, optionId: string): void {
  throw notImplemented("SearchService.recordSessionSelection");
}
