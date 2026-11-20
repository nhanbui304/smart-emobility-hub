// Tiện ích hiển thị thân thiện với người dùng (ẩn mã kỹ thuật UUID, chuẩn hóa tên tiếng Việt & tọa độ GPS thật ĐHQG-HCM).
import type { VehicleType } from "../types";

export const HUB_COORDS: Record<string, { lat: number; lng: number; shortName: string }> = {
  "Ga Metro ĐHQG": { lat: 10.8663, lng: 106.8012, shortName: "Ga Metro" },
  "ĐH Bách Khoa": { lat: 10.8805, lng: 106.8054, shortName: "ĐH Bách Khoa" },
  "Thư viện Trung tâm": { lat: 10.8691, lng: 106.7963, shortName: "Thư viện TT" },
  "ĐH KHTN": { lat: 10.8757, lng: 106.7992, shortName: "ĐH KHTN" },
  "KTX Khu B": { lat: 10.8825, lng: 106.7825, shortName: "KTX Khu B" },
};

export const CAMPUS_CENTER: [number, number] = [10.8755, 106.7965];

export function getHubCoords(hubName: string, fallbackIndex = 0): { lat: number; lng: number; shortName: string } {
  if (HUB_COORDS[hubName]) return HUB_COORDS[hubName];
  const entries = Object.values(HUB_COORDS);
  const found = Object.entries(HUB_COORDS).find(([k]) => hubName.toLowerCase().includes(k.toLowerCase()));
  if (found) return found[1];
  const fallback = entries[fallbackIndex % entries.length];
  return { lat: fallback.lat + fallbackIndex * 0.001, lng: fallback.lng + fallbackIndex * 0.001, shortName: hubName };
}

export function googleMapsDirectionsUrl(hubName: string): string {
  const { lat, lng } = getHubCoords(hubName);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function vehicleTypeLabel(type: VehicleType | string): string {
  if (type === "E_BIKE") return "Xe đạp điện";
  if (type === "E_MOTORBIKE") return "Xe máy điện";
  return type;
}

export function connectorTypeLabel(connector: string): string {
  switch (connector) {
    case "STANDARD_PLUG":
      return "Ổ cắm tiêu chuẩn (AC)";
    case "TYPE_2":
      return "Đầu sạc Type 2";
    case "FAST_DC":
      return "Sạc nhanh DC";
    default:
      return connector;
  }
}

/**
 * Tạo biển số hiển thị nhất quán từ mã xe dùng chung (vd: EB-01 -> 50-MD1 001.18, EM-04 -> 50-MD2 004.42)
 * để sinh viên dễ đối chiếu trực tiếp trên thân xe tại Hub.
 */
export function sharedVehiclePlate(code: string): string {
  const match = /^([A-Z]+)-?(\d+)$/i.exec(code.trim());
  if (!match) return code;
  const prefix = match[1].toUpperCase();
  const num = Number(match[2]);
  const series = prefix === "EM" ? "50-MD2" : "50-MD1";
  const tail = String((num * 17 + 11) % 90 + 10).padStart(2, "0");
  return `${series} ${String(num).padStart(3, "0")}.${tail}`;
}

/** Ước tính quãng đường còn lại theo % pin (xe điện khuôn viên ~45–50km khi đầy). */
export function estimateRangeKm(batteryLevel: number, type: VehicleType | string = "E_BIKE"): number {
  const maxKm = type === "E_MOTORBIKE" ? 55 : 42;
  return Math.max(1, Math.round((batteryLevel / 100) * maxKm));
}

/** Chuyển port UUID kỹ thuật sang nhãn thân thiện (Cổng sạc #01..#04) dựa trên hash ổn định. */
export function friendlyPortLabel(portId: string, index?: number): string {
  if (typeof index === "number") {
    return `Cổng sạc #${String(index + 1).padStart(2, "0")}`;
  }
  let hash = 0;
  for (let i = 0; i < portId.length; i++) hash = (hash * 31 + portId.charCodeAt(i)) | 0;
  const num = (Math.abs(hash) % 4) + 1;
  return `Cổng sạc #${String(num).padStart(2, "0")}`;
}
