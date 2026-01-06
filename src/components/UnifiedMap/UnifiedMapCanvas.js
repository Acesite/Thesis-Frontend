// src/components/UnifiedMap/UnifiedMapCanvas.js
import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Make sure this matches your env variable name
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const UnifiedMapCanvas = ({ showCrops, showCalamities }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // 1) Initialize map once
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [122.83, 10.35], // adjust to your default center (Bago City)
      zoom: 11,
    });

    mapRef.current = map;

    map.on("load", () => {
      // 2) CROPS source + layers  ------------------------
      // TODO: change URL to your real crop-geojson endpoint
      fetch("http://localhost:8081/api/crops-geojson")
        .then((res) => res.json())
        .then((cropGeoJson) => {
          if (!map.getSource("crops")) {
            map.addSource("crops", {
              type: "geojson",
              data: cropGeoJson,
            });
          }

          if (!map.getLayer("crops-fill")) {
            map.addLayer({
              id: "crops-fill",
              type: "fill",
              source: "crops",
              paint: {
                "fill-color": "#22c55e",
                "fill-opacity": 0.45,
              },
            });
          }

          if (!map.getLayer("crops-outline")) {
            map.addLayer({
              id: "crops-outline",
              type: "line",
              source: "crops",
              paint: {
                "line-color": "#15803d",
                "line-width": 1,
              },
            });
          }
        })
        .catch((err) => console.error("Error loading crops:", err));

      // 3) CALAMITIES source + layers  -------------------
      // TODO: change URL to your real calamity-geojson endpoint
      fetch("http://localhost:8081/api/calamities-geojson")
        .then((res) => res.json())
        .then((calamityGeoJson) => {
          if (!map.getSource("calamities")) {
            map.addSource("calamities", {
              type: "geojson",
              data: calamityGeoJson,
            });
          }

          if (!map.getLayer("calamities-fill")) {
            map.addLayer({
              id: "calamities-fill",
              type: "fill",
              source: "calamities",
              paint: {
                "fill-color": "#ef4444",
                "fill-opacity": 0.35,
              },
            });
          }

          if (!map.getLayer("calamities-outline")) {
            map.addLayer({
              id: "calamities-outline",
              type: "line",
              source: "calamities",
              paint: {
                "line-color": "#b91c1c",
                "line-width": 1,
              },
            });
          }
        })
        .catch((err) => console.error("Error loading calamities:", err));
    });

    return () => {
      map.remove();
    };
  }, []);

  // 4) React to toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cropLayers = ["crops-fill", "crops-outline"];
    const calamityLayers = ["calamities-fill", "calamities-outline"];

    cropLayers.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", showCrops ? "visible" : "none");
      }
    });

    calamityLayers.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(
          id,
          "visibility",
          showCalamities ? "visible" : "none"
        );
      }
    });
  }, [showCrops, showCalamities]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
};

export default UnifiedMapCanvas;
