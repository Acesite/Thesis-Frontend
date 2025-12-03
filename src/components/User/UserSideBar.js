import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AgriGISLogo from "../../components/MapboxImages/AgriGIS.png";
import Button from "../AdminCalamity/MapControls/Button";
import clsx from "clsx";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmt = (v) => (v ?? v === 0 ? v : "—");

const Section = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 shadow-sm">
    {title && (
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
    )}
    {children}
  </div>
);

const KV = ({ label, value }) => (
  <div className="flex flex-col">
    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900">{value}</dd>
  </div>
);

const CROP_COLORS = {
  Rice: "#facc15",
  Corn: "#fb923c",
  Banana: "#a3e635",
  Sugarcane: "#34d399",
  Cassava: "#60a5fa",
  Vegetables: "#f472b6",
};

const getCropColor = (name) => {
  if (!name) return null;
  const key = Object.keys(CROP_COLORS).find(
    (k) => k.toLowerCase() === String(name).toLowerCase()
  );
  return key ? CROP_COLORS[key] : null;
};

export default function UserSideBar({
  visible = true,
  zoomToBarangay,
  onBarangaySelect,
  crops = [],
  selectedCrop,
  cropTypes = [],
  selectedCropType,
  setSelectedCropType,
  setEnlargedImage,
}) {
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [barangayDetails, setBarangayDetails] = useState(null);
  const [harvestFilter, setHarvestFilter] = useState("all"); // ✅ local state
  const navigate = useNavigate();

  const handleBack = () => navigate("/");

  const barangayCoordinates = {
    Abuanan: [122.9844, 10.5275],
    Alianza: [122.92424927088227, 10.471876805354725],
    Atipuluan: [122.94997254227323, 10.51054338526979],
    Bacong: [123.03026270744279, 10.520037893339277],
    Bagroy: [122.87467558102158, 10.47702885963125],
    Balingasag: [122.84330579876998, 10.528672212250575],
    Binubuhan: [122.98236293756698, 10.457428765280468],
    Busay: [122.8936085581886, 10.536447801424544],
    Calumangan: [122.8857773056537, 10.55943773159997],
    Caridad: [122.89676017560787, 10.484855427956782],
    Dulao: [122.94775786836688, 10.549767917490168],
    Ilijan: [123.04567999131407, 10.44537414453059],
    "Lag-asan": [122.84543167453091, 10.519843756585255],
    Mailum: [123.05148249170527, 10.469013722796765],
    "Ma-ao": [123.018102985426, 10.508962844307234],
    Malingin: [122.92533490443519, 10.51102316577104],
    Napoles: [122.86024955431672, 10.510195807139885],
    Pacol: [122.86326134780008, 10.48966963268301],
    Poblacion: [122.83378471878187, 10.535871883140523],
    Sagasa: [122.89592554988106, 10.465232192594353],
    Tabunan: [122.93868999567334, 10.570304584775227],
    Taloc: [122.9100707275183, 10.57850192116514],
  };

  const barangayInfo = {
    Abuanan: { crops: ["Banana", "Rice"] },
    Alianza: { crops: ["Sugarcane", "Corn"] },
    Atipuluan: { crops: ["Banana", "Rice"] },
    Bacong: { crops: ["Rice", "Sugarcane"] },
    Bagroy: { crops: ["Corn", "Cassava"] },
    Balingasag: { crops: ["Rice", "Banana"] },
    Binubuhan: { crops: ["Sugarcane", "Corn"] },
    Busay: { crops: ["Rice", "Vegetables"] },
    Calumangan: { crops: ["Banana", "Sugarcane"] },
    Caridad: { crops: ["Cassava", "Sugarcane"] },
    Dulao: { crops: ["Rice", "Banana"] },
    Ilijan: { crops: ["Sugarcane", "Rice"] },
    "Lag-asan": { crops: ["Banana", "Corn"] },
    Mailum: { crops: ["Cassava", "Sugarcane"] },
    "Ma-ao": { crops: ["Rice", "Corn"] },
    Malingin: { crops: ["Sugarcane", "Rice"] },
    Napoles: { crops: ["Corn", "Banana"] },
    Pacol: { crops: ["Rice", "Vegetables"] },
    Poblacion: { crops: ["Rice", "Sugarcane"] },
    Sagasa: { crops: ["Cassava", "Rice"] },
    Tabunan: { crops: ["Banana", "Cassava"] },
    Taloc: { crops: ["Sugarcane", "Rice"] },
  };

  const handleBarangayChange = (e) => {
    const barangay = e.target.value;
    setSelectedBarangay(barangay);

    if (barangayCoordinates[barangay]) {
      const coordinates = barangayCoordinates[barangay];
      zoomToBarangay?.(coordinates);

      const details = barangayInfo[barangay] || {};
      setBarangayDetails({
        name: barangay,
        coordinates,
        crops: details.crops || [],
      });

      onBarangaySelect?.({ name: barangay, coordinates });
    } else {
      setBarangayDetails(null);
      onBarangaySelect?.(null);
    }
  };

  return (
    <div
      className={clsx(
        "absolute top-0 left-0 h-full z-50 bg-gray-50 overflow-y-auto border-r border-gray-200 shadow-md transition-all duration-300",
        visible ? "w-[500px] px-6 py-6" : "w-0 overflow-hidden px-0 py-0"
      )}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      {/* Hero image */}
      <div className="mb-4">
        <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 aspect-[16/9]">
          {selectedCrop?.photos ? (
            <img
              src={`http://localhost:5000${JSON.parse(selectedCrop.photos)[0]}`}
              alt={`${selectedCrop?.crop_name || "Crop"} photo`}
              className="h-full w-full object-cover cursor-pointer"
              onClick={() =>
                setEnlargedImage?.(
                  `http://localhost:5000${JSON.parse(selectedCrop.photos)[0]}`
                )
              }
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-2">
              <img src={AgriGISLogo} alt="AgriGIS" className="h-10 opacity-70" />
              <p className="text-xs text-gray-500">
                Select a field on the map to see details.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Back button */}
      <div className="mb-4">
        
      </div>

      {/* Location */}
      <Section title="Location">
        <dl className="grid grid-cols-3 gap-3">
          <KV label="Region" value="Western Visayas" />
          <KV label="Province" value="Negros Occidental" />
          <KV label="Municipality" value="Bago City" />
        </dl>
      </Section>

      {/* Selected Field */}
      {selectedCrop && (
        <Section title="Selected field">
          <dl className="grid grid-cols-2 gap-3">
            <KV label="Crop" value={fmt(selectedCrop.crop_name)} />
            <KV label="Variety" value={fmt(selectedCrop.variety_name)} />
            <KV label="Hectares" value={fmt(selectedCrop.estimated_hectares)} />
            <KV label="Est. Volume" value={fmt(selectedCrop.estimated_volume)} />
            <KV label="Planted Date" value={fmtDate(selectedCrop.planted_date)} />
            <KV label="Est. Harvest" value={fmtDate(selectedCrop.estimated_harvest)} />
            <KV label="Tagged by" value={fmt(selectedCrop.admin_name)} />
            <KV label="Tagged on" value={fmtDate(selectedCrop.created_at)} />
          </dl>
        </Section>
      )}

      {/* Barangay Overview */}
      {barangayDetails && (
        <Section title="Barangay overview">
          <p className="text-sm text-gray-900 font-medium">{barangayDetails.name}</p>
          <p className="text-xs text-gray-600 mt-1">
            Common crops: {barangayDetails.crops.join(", ") || "—"}
          </p>
        </Section>
      )}

      {/* Map Filters */}
      <Section title="Map filters">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Filter crop
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
              value={selectedCropType}
              onChange={(e) => setSelectedCropType?.(e.target.value)}
            >
              <option value="All">All</option>
              {cropTypes.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Barangay
            </label>
            <select
              value={selectedBarangay}
              onChange={handleBarangayChange}
              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
            >
              <option value="">All Barangays</option>
              {Object.keys(barangayCoordinates).map((brgy) => (
                <option key={brgy} value={brgy}>
                  {brgy}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Harvest status
            </label>
            <select
              value={harvestFilter}
              onChange={(e) => setHarvestFilter(e.target.value)} // ✅ safe local state
              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="harvested">Harvested only</option>
              <option value="not_harvested">Not yet harvested</option>
            </select>
          </div>
        </div>
      </Section>

      {/* Legend */}
      <Section title="Legend">
        <ul className="space-y-1 text-xs">
          {Object.entries(CROP_COLORS).map(([label, color]) => (
            <li key={label} className="flex items-center">
              <span
                className="inline-block w-3.5 h-3.5 rounded-full mr-2"
                style={{ backgroundColor: color }}
              />
              {label}
            </li>
          ))}
        </ul>
      </Section>

      {/* Buttons */}
      <div className="mt-5 flex gap-2">
        <Button to="/" variant="outline" size="md">
          Home
        </Button>
  
      </div>
    </div>
  );
}
