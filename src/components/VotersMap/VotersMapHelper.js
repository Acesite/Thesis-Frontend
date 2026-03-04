// src/components/Voters/VotersMapHelper.js
import mapboxgl from "mapbox-gl";

export const DEFAULT_HOUSEHOLD_FORM = {
  barangay_id: "",
  barangay_name: "",
  precinct_id: "",
  purok: "",
  sitio: "",
  voter_count: 0,
  mayor_candidate_id: "",
  vice_mayor_candidate_id: "",
  notes: "",
  family_leader_name: "",
  family_leader_age: "",
};

export function validateHouseholdForm(form) {
  const n = Number(form.voter_count);
  if (!Number.isFinite(n) || n < 0) return "Voter count must be 0 or greater.";
  return "";
}

export function getLoggedInUserId() {
  let uid = null;

  const adminUserJson = localStorage.getItem("adminUser");
  if (adminUserJson) {
    try {
      const adminUser = JSON.parse(adminUserJson);
      uid = adminUser.user_id || adminUser.id || null;
    } catch (e) {
      console.error("Failed to parse adminUser from localStorage", e);
    }
  }

  if (!uid) {
    const rawId =
      localStorage.getItem("user_id") || localStorage.getItem("admin_id");
    if (rawId) {
      const n = Number(rawId);
      if (Number.isFinite(n)) uid = n;
    }
  }

  return uid;
}

export function getBrgyName(props) {
  if (!props) return "";
  return (
    props.barangay_name ||
    props.BARANGAY ||
    props.Barangay ||
    props.brgy ||
    props.BRGY ||
    props.name ||
    props.NAME ||
    ""
  );
}

export function buildBarangayOptions(barangayList, BARANGAYS_FC) {
  if (Array.isArray(barangayList) && barangayList.length) {
    const set = new Set();
    for (const b of barangayList) {
      if (b?.barangay_name) set.add(String(b.barangay_name).trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  const set = new Set();
  for (const f of BARANGAYS_FC?.features || []) {
    const name = getBrgyName(f?.properties || {});
    if (name) set.add(String(name).trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng, lat, polygonCoords) {
  if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) return false;

  // outer ring
  if (!pointInRing(lng, lat, polygonCoords[0])) return false;

  // holes
  for (let h = 1; h < polygonCoords.length; h++) {
    if (pointInRing(lng, lat, polygonCoords[h])) return false;
  }
  return true;
}

export function detectBarangayForPoint(lng, lat, barangaysFC) {
  const features = barangaysFC?.features || [];
  for (const f of features) {
    const geom = f?.geometry;
    const name = getBrgyName(f?.properties || {});
    if (!geom || !name) continue;

    if (geom.type === "Polygon") {
      if (pointInPolygon(lng, lat, geom.coordinates)) return name;
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (pointInPolygon(lng, lat, poly)) return name;
      }
    }
  }
  return "";
}

export function clearMarkers(savedMarkersRef, householdMarkerMapRef) {
  try {
    for (const mk of savedMarkersRef.current) mk.remove();
  } catch {}
  savedMarkersRef.current = [];
  householdMarkerMapRef.current.clear();
}

export function clearTempMarker(tempMarkerRef) {
  try {
    if (tempMarkerRef.current) tempMarkerRef.current.remove();
  } catch {}
  tempMarkerRef.current = null;
}

export function addTempMarker(map, tempMarkerRef, lng, lat) {
  clearTempMarker(tempMarkerRef);
  tempMarkerRef.current = new mapboxgl.Marker({ color: "#ef4444" })
    .setLngLat([lng, lat])
    .addTo(map);
}

export function getMarkerColor() {
  return "#2563eb";
}

export function buildHouseholdPopupHTML(row) {
  return `
    <div style="font-size:12px">
      <div style="font-weight:700;margin-bottom:6px">Household #${row.id}</div>
      <div><b>Barangay:</b> ${row.barangay_name ?? "-"}</div>
      <div><b>Precinct:</b> ${row.precinct_no ?? row.precinct_id ?? "-"}</div>
      <hr style="margin:6px 0"/>
      <div><b>Voter count:</b> ${row.voter_count ?? 0}</div>
      <div><b>Mayor:</b> ${row.mayor_vote ?? "-"}</div>
      <div><b>Vice Mayor:</b> ${row.vice_mayor_vote ?? "-"}</div>
    </div>
  `;
}


export function MarkCircleIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="7"
        stroke={active ? "#ef4444" : "#111827"}
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="2.2" fill={active ? "#ef4444" : "#111827"} />
    </svg>
  );
}