import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Import components
import Sidebar from "../User/UserSideBar";

// Import thumbnails
import DefaultThumbnail from "../MapboxImages/map-default.png";
import SatelliteThumbnail from "../MapboxImages/map-satellite.png";
import DarkThumbnail from "../MapboxImages/map-dark.png";
import LightThumbnail from "../MapboxImages/map-light.png";

mapboxgl.accessToken =
  "pk.eyJ1Ijoid29tcHdvbXAtNjkiLCJhIjoiY204emxrOHkwMGJsZjJrcjZtZmN4YXdtNSJ9.LIMPvoBNtGuj4O36r3F72w";

const UserMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRef = useRef(null);

  const [lng] = useState(122.961602);
  const [lat] = useState(10.507447);
  const [zoom] = useState(11);
  const [mapStyle, setMapStyle] = useState("mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d");
  const [showLayers, setShowLayers] = useState(false);
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState(null);

  const mapStyles = {
    Default: {
      url: "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d",
      thumbnail: DefaultThumbnail,
    },
    Satellite: {
      url: "mapbox://styles/wompwomp-69/cm96vey9z009001ri48hs8j5n",
      thumbnail: SatelliteThumbnail,
    },
    Dark: {
      url: "mapbox://styles/wompwomp-69/cm96veqvt009101szf7g42jps",
      thumbnail: DarkThumbnail,
    },
    Light: {
      url: "mapbox://styles/wompwomp-69/cm976c2u700ab01rc0cns2pe0",
      thumbnail: LightThumbnail,
    },
  };

  const zoomToBarangay = (barangayCoordinates) => {
    if (map.current) {
      map.current.flyTo({
        center: barangayCoordinates,
        zoom: 12,
        essential: true,
      });
    }
  };

  const handleBarangaySelect = (barangayData) => {
    setSelectedBarangay(barangayData);

    if (markerRef.current) {
      markerRef.current.remove();
    }

    if (map.current && barangayData) {
      const el = document.createElement("div");
      el.className = "marker";
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#10B981";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.3)";

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <h3 class="font-bold text-green-600">${barangayData.name}</h3>
        <p class="text-sm">Coordinates: ${barangayData.coordinates[1].toFixed(6)}, ${barangayData.coordinates[0].toFixed(6)}</p>
      `);

      markerRef.current = new mapboxgl.Marker(el)
        .setLngLat(barangayData.coordinates)
        .setPopup(popup)
        .addTo(map.current);

      markerRef.current.togglePopup();
    }
  };

  useEffect(() => {
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [lng, lat],
        zoom: zoom,
      });
      map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    } else {
      map.current.setStyle(mapStyle);
    }

    map.current.on("style.load", () => {
      if (selectedBarangay && markerRef.current) {
        const el = document.createElement("div");
        el.className = "marker";
        el.style.width = "18px";
        el.style.height = "18px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#10B981";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.3)";

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <h3 class="font-bold text-green-600">${selectedBarangay.name}</h3>
          <p class="text-sm">Coordinates: ${selectedBarangay.coordinates[1].toFixed(6)}, ${selectedBarangay.coordinates[0].toFixed(6)}</p>
        `);

        markerRef.current = new mapboxgl.Marker(el)
          .setLngLat(selectedBarangay.coordinates)
          .setPopup(popup)
          .addTo(map.current);
      }
    });
  }, [mapStyle, lng, lat, zoom, selectedBarangay]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .mapboxgl-popup-content {
        padding: 12px;
        border-radius: 8px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen">
      <div ref={mapContainer} className="h-full w-full" />

      <Sidebar
        mapStyles={mapStyles}
        setMapStyle={setMapStyle}
        showLayers={showLayers}
        setShowLayers={setShowLayers}
        zoomToBarangay={zoomToBarangay}
        onBarangaySelect={handleBarangaySelect}
      />

      {/* Map Style Toggle Button */}
      <div
        onClick={() => setIsSwitcherVisible(!isSwitcherVisible)}
        className="absolute top-5 right-5 w-[70px] h-[70px] bg-cover bg-center rounded-xl shadow-md cursor-pointer z-10 flex flex-col items-center justify-end p-1"
        style={{ backgroundImage: `url(${SatelliteThumbnail})` }}
      >
        <div className=" bg-opacity-50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 10h18M3 6h18M3 14h18M3 18h18"
            />
          </svg>
          Layers
        </div>
      </div>

      {/* Map Style Switcher Panel */}
      {isSwitcherVisible && (
        <div className="absolute top-24 right-5 bg-white p-4 rounded-2xl shadow-lg flex space-x-3 items-center z-10">
          {Object.entries(mapStyles).map(([styleName, styleData]) => (
            <div key={styleName} className="flex flex-col items-center">
              <button
                onClick={() => setMapStyle(styleData.url)}
                className={`rounded-xl overflow-hidden border-4 transition-all duration-300 shadow-md ${
                  mapStyle === styleData.url ? "border-blue-500" : "border-transparent"
                }`}
              >
                <img
                  src={styleData.thumbnail}
                  alt={styleName}
                  className="w-16 h-16 object-cover"
                />
              </button>
              <span
                className={`mt-1 text-xs font-semibold ${
                  mapStyle === styleData.url ? "text-blue-600" : "text-gray-600"
                }`}
              >
                {styleName}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserMap;