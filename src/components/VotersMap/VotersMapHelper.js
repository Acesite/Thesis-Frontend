// src/components/Voters/VotersMapHelper.js
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";

/* ---------- GeoJSON helpers ---------- */
export function getBrgyName(props) {
  return (
    props?.Barangay ||
    props?.barangay ||
    props?.BRGY ||
    props?.brgy ||
    props?.NAME ||
    props?.name ||
    ""
  );
}

export function detectBarangayForPoint(lng, lat, fc) {
  if (!fc?.features?.length) return null;

  const pt = turf.point([lng, lat]);

  for (const f of fc.features) {
    const g = f?.geometry;
    if (!g) continue;

    try {
      if (turf.booleanPointInPolygon(pt, g)) {
        return getBrgyName(f.properties || "") || null;
      }
    } catch {
      // ignore invalid geometry
    }
  }

  return null;
}

/* ---------- Mark tool icon ---------- */
export function MarkCircleIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="7.5"
        stroke={active ? "#ef4444" : "#111827"}
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="2" fill={active ? "#ef4444" : "#111827"} />
    </svg>
  );
}

/* ---------- marker utilities ---------- */
export function clearMarkers(savedMarkersRef, householdMarkerMapRef) {
  savedMarkersRef.current.forEach((m) => m.remove());
  savedMarkersRef.current = [];
  householdMarkerMapRef.current.clear();
}

export function clearTempMarker(tempMarkerRef) {
  if (tempMarkerRef.current) {
    try {
      tempMarkerRef.current.remove();
    } catch {}
    tempMarkerRef.current = null;
  }
}

export function addTempMarker(map, tempMarkerRef, lng, lat, color = "#2563eb") {
  clearTempMarker(tempMarkerRef);
  tempMarkerRef.current = new mapboxgl.Marker({ color })
    .setLngLat([lng, lat])
    .addTo(map);
  return tempMarkerRef.current;
}

/* ---------- business rules ---------- */
export function getMarkerColor(row) {
  const eligible = Number(row.eligible_voters || 0);
  const yes = Number(row.voting_for_us || 0);

  if (eligible <= 0) return "#3B82F6";

  const ratio = yes / eligible;
  if (ratio >= 0.6) return "#10B981";
  if (ratio >= 0.3) return "#F59E0B";
  return "#EF4444";
}

export function validateCounts(form) {
  const eligible = Number(form.eligible_voters || 0);
  const sum =
    Number(form.voting_for_us || 0) +
    Number(form.undecided || 0) +
    Number(form.not_supporting || 0);

  if (eligible < 0) return "Eligible voters cannot be negative.";
  if (sum > eligible)
    return "For us + Undecided + Not supporting must be <= Eligible voters.";
  return null;
}