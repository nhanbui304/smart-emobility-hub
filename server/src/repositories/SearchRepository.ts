// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Sequence Sub #2 gọi chung là OperationalRepository; trong code tách theo nghiệp vụ (xem bảng ánh xạ trong báo cáo).
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";
import type { MobilityContext, MobilityOption, SearchCriteria } from "../services/SearchService";

export interface SearchSession {
  sessionId: string;
  studentId: string;
  criteria: SearchCriteria;
  options: MobilityOption[];
  selectedOptionId?: string;
  createdAt: Date;
}

/** Phiên tìm kiếm lưu tạm trong bộ nhớ theo sessionId (mất khi khởi động lại server thì tìm lại). */
const searchSessionStore = new Map<string, SearchSession>();

export const searchRepository = {
  /** UC01 bước 3 (queryMobilityContext): Hub, xe, chỗ đỗ, cổng sạc liên quan tiêu chí; loại trừ tài nguyên bị hạn chế do sự cố. */
  queryMobilityContext(criteria: SearchCriteria): MobilityContext {
    throw notImplemented("SearchRepository.queryMobilityContext (UC01)");
  },

  /** UC01 bước 6 (queryCurrentOptionState): tình trạng hiện tại của Hub / tài nguyên trong phương án. */
  queryCurrentOptionState(option: MobilityOption, criteria: SearchCriteria): MobilityOption | undefined {
    throw notImplemented("SearchRepository.queryCurrentOptionState (UC01)");
  },

  saveSearchSession(session: SearchSession): void {
    throw notImplemented("SearchRepository.saveSearchSession (UC01)");
  },

  findSearchSession(sessionId: string, studentId: string): SearchSession | undefined {
    throw notImplemented("SearchRepository.findSearchSession (UC01)");
  },

  /** UC01 bước 6 (recordSessionSelection). */
  recordSessionSelection(sessionId: string, optionId: string): void {
    throw notImplemented("SearchRepository.recordSessionSelection (UC01)");
  },
};
