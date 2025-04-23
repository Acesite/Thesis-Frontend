import React, { useState } from "react";
import AgriGISLogo from "../../components/MapboxImages/AgriGIS.png";

const UserSideBar = ({ zoomToBarangay, onBarangaySelect }) => {
  const [selectedBarangay, setSelectedBarangay] = useState("");

  const barangayCoordinates = {
    Abuanan: [122.99213574028387, 10.525249002551618],
    Alianza: [122.929862, 10.473330],
    Atipuluan: [122.95632362296796,10.511287473738285],
    Bacong: [122.917651, 10.493901],
    Bagroy: [122.872328,10.477060],
    Balingasag: [122.845262,10.531602],
    Binubuhan: [122.98344191696818,10.457513959185397],
    Busay: [122.888361,10.537245],
    Calumangan: [122.876632,10.559581112711328],
    Caridad: [122.940823, 10.486633],
    Dulao: [122.958018, 10.490659],
    Ilijan: [122.971040, 10.498089],
    "Lag-asan": [122.951085, 10.511455],
    Mailum: [122.977706, 10.522196],
    "Ma-ao": [122.939712, 10.528344],
    Malingin: [122.931746, 10.536495],
    Napoles: [122.926812, 10.519978],
    Pacol: [122.928250, 10.505916],
    Poblacion: [122.960903, 10.507042],
    Sagasa: [122.954496, 10.518531],
    Tabunan: [122.973885, 10.506478],
    Taloc: [122.947307, 10.531319],
    Talon: [122.943887, 10.520805],
    Tinongan: [122.939491, 10.497410],
  };

  const handleBarangayChange = (e) => {
    const barangay = e.target.value;
    setSelectedBarangay(barangay);
    
    if (barangayCoordinates[barangay]) {
      const coordinates = barangayCoordinates[barangay];
      zoomToBarangay(coordinates); // Zoom to selected barangay
      
      // Pass the selected barangay's name and coordinates to parent component
      onBarangaySelect({
        name: barangay,
        coordinates: coordinates
      });
    }
  };

  return (
    <div className="absolute top-0 left-0 h-full w-80 bg-white shadow-2xl z-20 p-6 overflow-y-auto border-r border-gray-200">
      {/* Logo */}
      <div className="mb-8 flex justify-center">
        <img src={AgriGISLogo} alt="AgriGIS Logo" className="h-[75px] object-contain" />
      </div>

      {/* Section Title */}
      <h2 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Location Information</h2>

      {/* Region */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">Region</label>
        <input
          type="text"
          value="Western Visayas"
          readOnly
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
        />
      </div>

      {/* Province */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">Province</label>
        <input
          type="text"
          value="Negros Occidental"
          readOnly
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
        />
      </div>

      {/* Municipality */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">Municipality</label>
        <input
          type="text"
          value="Bago City"
          readOnly
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
        />
      </div>

      {/* Barangay */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">Barangay</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          value={selectedBarangay}
          onChange={handleBarangayChange}
        >
          <option value="">Select a barangay</option>
          {[
            "Abuanan", "Alianza", "Atipuluan", "Bacong", "Bagroy", "Balingasag",
            "Binubuhan", "Busay", "Calumangan", "Caridad", "Dulao", "Ilijan",
            "Lag-asan", "Mailum", "Ma-ao", "Malingin", "Napoles", "Pacol",
            "Poblacion", "Sagasa", "Tabunan", "Taloc", "Talon", "Tinongan"
          ].map((brgy) => (
            <option key={brgy} value={brgy}>{brgy}</option>
          ))}
        </select>
      </div>

      {/* Crop Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">Crop Suitability</label>
        {["Banana", "Cassava", "Corn", "Sugarcane", "Rice", "Vegetables"].map((crop) => (
          <div className="flex items-center mb-1" key={crop}>
            <input type="checkbox" id={crop} className="mr-5 accent-green-600" />
            <label htmlFor={crop} className="text-sm text-gray-700">{crop}</label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserSideBar;