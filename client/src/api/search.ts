// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Gọi API của SearchController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { OptionSelectionResult, SearchCriteria, SearchFormConfig, SearchResult } from "../types";
import { api } from "./client";

export const searchApi = {
  /** GET /api/search/form */
  loadSearchForm: () =>
    api.get<SearchFormConfig>("/search/form"),
  /** POST /api/search/options */
  searchMobilityOptions: (criteria: SearchCriteria) =>
    api.post<SearchResult>("/search/options", { criteria }),
  /** POST /api/search/selections */
  confirmOptionSelection: (sessionId: string, optionId: string) =>
    api.post<OptionSelectionResult>("/search/selections", { sessionId, optionId }),
};
