/**
 * Tham số cấu hình nghiệp vụ – gom về MỘT chỗ.
 * Tài liệu Submission #1 chỉ ghi "tham số cấu hình"; các giá trị dưới đây là giá trị nhóm
 * chọn cho bản demo. Muốn đổi thì đổi ở đây, không viết số cứng trong service.
 */
export const systemConfig = {
  /**
   * UC06, mục 2.3.1: thời gian giữ tạm vị trí đỗ trước khi xác nhận (phút).
   * Kiểm thử TC-2.3.1-01 có thể đặt ngắn hơn bằng biến môi trường PARKING_HOLD_MINUTES (ví dụ 1).
   */
  parkingHoldMinutes: Number(process.env.PARKING_HOLD_MINUTES ?? 30),
  /** UC06: khung giờ đặt chỗ đỗ dài tối đa (giờ). */
  parkingMaxDurationHours: 24,
  /** UC05: thời gian giữ vị trí cho lượt trả xe đang chờ sinh viên đưa xe vào (phút). */
  returnAllocationMinutes: 30,
  /** UC02: hạn nhận xe sau khi đặt (phút). */
  pickupDeadlineMinutes: 30,
  /** UC02: mức pin tối thiểu để xe được hiển thị là có thể đặt (%). */
  reservableBatteryThreshold: 30,
  /** UC04: mức pin tối thiểu khi nhận xe (%). */
  pickupBatteryThreshold: 20,
  /** UC07: dưới mức này được ưu tiên trong hàng đợi sạc (%). */
  lowBatteryChargingPriority: 25,
  /** UC10: cảnh báo thiếu xe khi số xe khả dụng của Hub <= ngưỡng này. */
  lowVehicleThreshold: 2,
  /** UC10: cảnh báo sắp đầy khi số chỗ trống của Hub <= ngưỡng này. */
  nearFullThreshold: 1,
  /** UC10: dữ liệu Hub coi là cũ nếu không cập nhật quá số giây này. */
  dataStaleSeconds: 30,
  /** Chu kỳ chạy bộ giả lập xe (ms). */
  simulatorTickMs: 1000,
  /** Chu kỳ chạy các scheduler hết hạn / cảnh báo (ms). */
  schedulerIntervalMs: 15_000,
  /** UC11/UC13: thời hạn sinh viên phản hồi đồng ý thay đổi (phút). */
  consentResponseDeadlineMinutes: 60,
};

export type SystemConfig = typeof systemConfig;
