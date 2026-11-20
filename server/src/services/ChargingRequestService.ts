// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC07.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingRequest, PrivateVehicle } from "../db/schema";
import { AppError } from "../lib/errors";
import { operationalRepository } from "../repositories/OperationalRepository";
import {
  getStudentChargingContext,
  hasConflictingActiveChargingReservation,
  recordPreparedChargingProposal,
} from "../repositories/operational/chargingRequestOps";
import type {
  CancelChargingResult,
  ChargingNeed,
  ChargingProposal,
  ChargingRequestResult,
} from "../types/dto";

export const chargingRequestService = {
  /** Hỗ trợ UI lấy danh sách xe cá nhân & yêu cầu sạc của sinh viên đang đăng nhập (đi qua Service đúng phân tầng). */
  async getMyContext(studentId: string): Promise<{ vehicles: PrivateVehicle[]; requests: ChargingRequest[] }> {
    return getStudentChargingContext(studentId);
  },

  async prepareChargingRequest(
    studentId: string,
    hubId: string,
    vehicleId: string,
    chargingNeed: ChargingNeed,
  ): Promise<ChargingProposal> {
    if (!validateChargingNeed(chargingNeed)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Nhu cầu sạc không hợp lệ (mức pin mục tiêu phải lớn hơn mức pin hiện tại và nằm trong 0–100%).",
      );
    }

    if (!operationalRepository.findVehicleChargingRight(studentId, vehicleId)) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền gửi yêu cầu sạc cho phương tiện này.");
    }

    if (!operationalRepository.checkVehicleAtHubAndCompatible(hubId, vehicleId)) {
      throw new AppError(
        "CONFLICT",
        "Hub đã chọn không có cổng sạc hoạt động tương thích với đầu cắm của phương tiện.",
      );
    }

    const now = new Date();
    const conflicts = operationalRepository.findConflictingChargingRecords(studentId, vehicleId);
    if (conflicts.length > 0 || hasConflictingActiveChargingReservation(vehicleId, now)) {
      throw new AppError(
        "CONFLICT",
        "Phương tiện này hiện đã có yêu cầu sạc hoặc lịch sạc xung đột đang hiệu lực.",
      );
    }

    const proposal = operationalRepository.evaluateChargingAllocation(hubId, vehicleId, chargingNeed, now);
    recordPreparedChargingProposal(studentId, hubId, vehicleId, proposal, now);
    return proposal;
  },

  /** UC07: gửi yêu cầu sạc ngay tại Hub; được phân cổng hoặc vào hàng đợi. */
  async submitChargingRequest(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
    chargingNeed: ChargingNeed,
  ): Promise<ChargingRequestResult> {
    if (!validateChargingNeed(chargingNeed)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Nhu cầu sạc không hợp lệ (mức pin mục tiêu phải lớn hơn mức pin hiện tại và nằm trong 0–100%).",
      );
    }

    return operationalRepository.atomicSubmitChargingRequest(
      requestId,
      studentId,
      hubId,
      vehicleId,
      chargingNeed,
      new Date(),
    );
  },

  /** Cancel Charging Request: hủy yêu cầu chưa bắt đầu sạc. */
  async cancelChargingRequest(
    requestId: string,
    studentId: string,
    chargingRequestId: string,
  ): Promise<CancelChargingResult> {
    const existing = operationalRepository.findChargingRequest(chargingRequestId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu sạc.");
    }
    if (existing.studentId !== studentId) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền hủy yêu cầu sạc của sinh viên khác.");
    }
    if (existing.status !== "CANCELLED" && !checkCancellationAllowed(existing)) {
      throw new AppError(
        "CONFLICT",
        "Yêu cầu sạc đã bắt đầu sạc, đã hoàn tất hoặc đã hết hạn nên không thể hủy.",
      );
    }

    return operationalRepository.atomicCancelChargingRequest(
      requestId,
      studentId,
      chargingRequestId,
      new Date(),
    );
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram UC07.drawio) ----------

/** private (–) trong class diagram: kiểm tra tính hợp lệ của mức pin hiện tại và mức pin mục tiêu. */
function validateChargingNeed(chargingNeed: ChargingNeed): boolean {
  return (
    Number.isInteger(chargingNeed.currentBattery) &&
    Number.isInteger(chargingNeed.targetBattery) &&
    chargingNeed.currentBattery >= 0 &&
    chargingNeed.targetBattery <= 100 &&
    chargingNeed.targetBattery > chargingNeed.currentBattery
  );
}

/** private (–) trong class diagram: chỉ cho hủy khi yêu cầu còn ở trạng thái WAITING hoặc ALLOCATED. */
function checkCancellationAllowed(request: ChargingRequest): boolean {
  return request.status === "WAITING" || request.status === "ALLOCATED";
}
