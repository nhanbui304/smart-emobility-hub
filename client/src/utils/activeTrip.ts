// Owner: Lê Quốc Linh (UC04) – nhớ chuyến đi vừa bắt đầu để trang "Chuyến đi" còn hiển thị sau khi tải lại.
// Quang Nhân (UC05): sau khi trả xe thành công gọi clearStoredTrip().
import type { Trip } from "../types";

const KEY = "smart-emobility:active-trip";

export function getStoredTrip(): Trip | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Trip) : null;
  } catch {
    return null;
  }
}

export function storeTrip(trip: Trip): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trip));
  } catch {
    /* bỏ qua: chỉ là tiện ích hiển thị */
  }
}

export function clearStoredTrip(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
}
