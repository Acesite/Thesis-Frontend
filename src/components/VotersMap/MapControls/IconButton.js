// src/components/AdminDAR/MapControls/IconButton.jsx
import React from "react";

const IconButton = ({ title, active, onClick, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`w-9 h-9 grid place-items-center rounded-lg border transition shadow-sm ${
      active
        ? "bg-emerald-600 text-white border-emerald-600"
        : "bg-white text-gray-800 border-gray-300"
    } hover:shadow-md`}
  >
    {children}
  </button>
);

export default IconButton;
