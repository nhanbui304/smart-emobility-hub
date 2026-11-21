// Bản đồ tương tác thật Khu đô thị ĐHQG-HCM (Leaflet + CartoDB Voyager / Dark Matter — miễn phí, không cần API key).
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import type { HubStatus } from "../types";
import { CAMPUS_CENTER, getHubCoords } from "../utils/display";

export type MapMetric = "RENT_VEHICLE" | "PARK" | "CHARGE";

interface CampusHubMapProps {
  hubs: HubStatus[];
  selectedHubId: string | null;
  onSelectHub: (hubId: string) => void;
  mode?: "student" | "operator";
  metric?: MapMetric;
  alertCountByHubId?: Map<string, number>;
  className?: string;
}

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function metricText(hub: HubStatus, metric: MapMetric): string {
  if (metric === "PARK") return `${hub.freeSlots} chỗ`;
  if (metric === "CHARGE") return `${hub.freeChargingPorts} sạc`;
  return `${hub.availableVehicles} xe`;
}

export function CampusHubMap({
  hubs,
  selectedHubId,
  onSelectHub,
  mode = "student",
  metric = "RENT_VEHICLE",
  alertCountByHubId,
  className = "h-[460px] w-full",
}: CampusHubMapProps) {
  const { resolved } = useTheme();
  const isDark = resolved === "DARK";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const prevSelectedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelectHub);
  onSelectRef.current = onSelectHub;

  // Khởi tạo bản đồ Leaflet + OpenStreetMap (miễn phí 100%, không cần API key)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: CAMPUS_CENTER,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    tileRef.current = L.tileLayer(OSM_TILES, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);
    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersLayerRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      markersLayerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Tự căn khung hiển thị trọn 5 Hub trong ĐHQG-HCM lần đầu tải
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedRef.current || hubs.length === 0) return;
    const bounds = L.latLngBounds(
      hubs.map((h, i) => {
        const { lat, lng } = getHubCoords(h.name, i);
        return [lat, lng] as [number, number];
      }),
    );
    map.fitBounds(bounds, { padding: [52, 52], maxZoom: 15 });
    fittedRef.current = true;
  }, [hubs]);

  // Vẽ lại pin các Hub khi dữ liệu polling 3 giây cập nhật hoặc đổi Hub chọn
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    hubs.forEach((hub, index) => {
      const { lat, lng, shortName } = getHubCoords(hub.name, index);
      const isSelected = hub.id === selectedHubId;
      const alerts = alertCountByHubId?.get(hub.id) ?? 0;

      let pillBg = isSelected ? "#123b2c" : isDark ? "#17221d" : "#ffffff";
      let pillText = isSelected ? "#ffffff" : isDark ? "#f3f4f6" : "#111827";
      let pillBorder = isSelected ? "#c8f169" : isDark ? "#2c423a" : "#d1dbd5";
      let badgeBg = isSelected ? "#c8f169" : "#dcfce7";
      let badgeText = "#123b2c";
      let badgeLabel = metricText(hub, metric);

      if (mode === "operator" && alerts > 0) {
        badgeBg = "#fef3c7";
        badgeText = "#92400e";
        pillBorder = isSelected ? "#c8f169" : "#f59e0b";
        badgeLabel = `${alerts} cảnh báo`;
      } else if (isDark && !isSelected) {
        badgeBg = "#1e3a2f";
        badgeText = "#c8f169";
      }

      const html = `
        <div style="
          display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
          padding:6px 11px 6px 8px;border-radius:999px;
          background:${pillBg};color:${pillText};
          border:${isSelected ? "2.5px" : "1.5px"} solid ${pillBorder};
          box-shadow:0 6px 18px rgba(10,30,20,${isSelected ? "0.28" : "0.14"});
          font-size:12px;font-weight:700;cursor:pointer;
          transform:translate(-50%,-50%) scale(${isSelected ? "1.06" : "1"});
          transition:transform 160ms ease, box-shadow 160ms ease;
        ">
          <span style="
            background:${badgeBg};color:${badgeText};
            padding:2px 7px;border-radius:999px;font-size:11px;font-weight:800;
          ">${badgeLabel}</span>
          <span>${shortName}</span>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: "hub-map-pin",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: isSelected ? 500 : alerts > 0 ? 300 : 100,
      });
      marker.on("click", () => onSelectRef.current(hub.id));
      marker.addTo(layer);
    });
  }, [hubs, selectedHubId, mode, metric, alertCountByHubId, isDark]);

  // Di chuyển nhẹ tâm bản đồ khi người dùng chuyển sang Hub khác
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedHubId) return;
    if (prevSelectedRef.current === null) {
      prevSelectedRef.current = selectedHubId;
      return;
    }
    if (prevSelectedRef.current === selectedHubId) return;
    prevSelectedRef.current = selectedHubId;
    const idx = hubs.findIndex((h) => h.id === selectedHubId);
    if (idx === -1) return;
    const { lat, lng } = getHubCoords(hubs[idx].name, idx);
    map.panTo([lat, lng], { animate: true, duration: 0.4 });
  }, [selectedHubId, hubs]);

  return (
    <div
      ref={containerRef}
      aria-label="Bản đồ các Mobility Hub tại ĐHQG-HCM"
      className={`overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-white/10 ${className}`}
    />
  );
}
