import React, { useEffect, useRef, useState } from "react";
import { XIcon, SaveIcon } from "lucide-react";

const TagCropForm = ({ onCancel, onSave, defaultLocation }) => {
  const formRef = useRef(null);
  const [hectares, setHectares] = useState("");

  useEffect(() => {
    if (defaultLocation?.hectares) {
      setHectares(defaultLocation.hectares);
    }
  }, [defaultLocation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
  
    const crop = form.crop.value;
    const variety = form.variety.value;
    const plantedDate = form.plantedDate.value;
    const estimatedHarvest = form.estimatedHarvest.value;
    const estimatedVolume = form.estimatedVolume.value;
    const estimatedHectares = hectares;
    const note = form.note.value;
  
    await onSave({
      coordinates: defaultLocation.coordinates || [defaultLocation.lng, defaultLocation.lat],
      crop,
      variety,
      plantedDate,
      estimatedHarvest,
      estimatedVolume,
      estimatedHectares,
      note,
    });
  
    form.reset(); 
    setHectares("");  
  };
  

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl">
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center border-b pb-2">
          📍 Tag Crop at Location
        </h2>
        <form onSubmit={handleSubmit} ref={formRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🌾 Crop Type</label>
            <input name="crop" required className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🌱 Crop Variety <span className="text-xs text-gray-400">(optional)</span></label>
            <input name="variety" className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📅 Date Planted</label>
            <input type="date" name="plantedDate" required className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🔜 Estimated Harvest Date</label>
            <input type="date" name="estimatedHarvest" required className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📦 Estimated Yield (sacks)</label>
            <input
              name="estimatedVolume"
              type="number"
              min="0"
              step="0.1"
              required
              className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📐 Area Size (hectares)</label>
            <input
              name="estimatedHectares"
              type="number"
              min="0"
              step="0.01"
              required
              readOnly
              value={hectares}
              className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-gray-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">📝 Notes / Observations</label>
            <textarea
              name="note"
              rows="3"
              className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              <XIcon size={16} /> Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <SaveIcon size={16} /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TagCropForm;
