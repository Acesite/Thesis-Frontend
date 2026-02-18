// components/Admin/AdminGlossary.js
import React, { useMemo, useState } from "react";
import SuperAdminNav from "../NavBar/SuperAdminSideBar";
import Footer from "../LandingPage/Footer";

/* ------------------------------- Glossary data ------------------------------ */
const GLOSSARY_ITEMS = [
  // SYSTEM / GENERAL
  {
    term: "AgriGIS",
    category: "System",
    definition:
      "The Bago City Department of Agriculture’s digital system for mapping farms, crops, and calamity reports using GIS and satellite imagery.",
  },
  {
    term: "Field",
    category: "Mapping",
    definition:
      "A mapped piece of agricultural land owned or managed by a farmer. In AgriGIS, each field is drawn as a polygon on the map.",
  },
  {
    term: "Parcel",
    category: "Mapping",
    definition:
      "Another word for a field or land unit used in mapping and land records.",
  },
  {
    term: "Barangay",
    category: "Mapping",
    definition:
      "The smallest local government unit in the Philippines. All fields and farmers in AgriGIS are linked to a barangay in Bago City.",
  },
  {
    term: "Farmer",
    category: "Farmer",
    definition:
      "A registered AgriGIS user who manages or cultivates one or more fields and submits crop and calamity information.",
  },
  {
    term: "Tenant farmer",
    category: "Farmer",
    definition:
      "A farmer who cultivates land owned by someone else in exchange for rent or a share of the harvest.",
  },
  {
    term: "Landowner",
    category: "Farmer",
    definition:
      "The person or entity that holds the legal ownership of the land used for farming.",
  },
  {
    term: "Anonymous farmer",
    category: "Farmer",
    definition:
      "A farmer record stored without full personal details, used when the farmer prefers not to disclose their identity.",
  },

  // CROPS
  {
    term: "Crop type",
    category: "Crops",
    definition:
      "The main type of crop planted in a field, such as Rice, Corn, Sugarcane, Banana, Cassava, or Vegetables.",
  },
  {
    term: "Variety",
    category: "Crops",
    definition:
      "The specific kind of crop within a crop type, for example ‘NSIC Rc 222’ for rice or a named variety for corn or banana.",
  },
  {
    term: "Estimated hectares",
    category: "Crops",
    definition:
      "The size of the field in hectares, based on the polygon drawn on the map or the farmer’s reported area.",
  },
  {
    term: "Estimated volume",
    category: "Crops",
    definition:
      "The expected harvest quantity for the field, such as number of sacks, tons, or kilograms.",
  },
  {
    term: "Planted date",
    category: "Crops",
    definition:
      "The date when the main crop was planted in the field. Used by the system to monitor growth stage and expected harvest.",
  },
  {
    term: "Estimated harvest date",
    category: "Crops",
    definition:
      "The expected date when the crop will be ready for harvest based on planting date and crop type.",
  },
  {
    term: "Harvested date",
    category: "Crops",
    definition:
      "The actual date when the crop was harvested and the field was marked as harvested in AgriGIS.",
  },
  {
    term: "Harvest status",
    category: "Crops",
    definition:
      "Indicates if a field is already harvested or not yet harvested. Used for map filtering and harvest analytics.",
  },

  // CROPPING SYSTEM
  {
    term: "Cropping system",
    category: "Cropping system",
    definition:
      "The pattern or method of planting crops in a field, including monocrop and different types of intercropping.",
  },
  {
    term: "Monocrop",
    category: "Cropping system",
    definition:
      "A cropping system where only one type of crop is planted in a field during a season.",
  },
  {
    term: "Intercropping",
    category: "Cropping system",
    definition:
      "Planting two or more crops in the same field at the same time or during overlapping periods.",
  },
  {
    term: "Relay intercropping",
    category: "Cropping system",
    definition:
      "An intercropping method where a second crop is planted before the first crop is fully harvested, so their growth periods overlap.",
  },
  {
    term: "Strip intercropping",
    category: "Cropping system",
    definition:
      "Planting different crops in long strips within the same field so they can be managed separately but still interact.",
  },
  {
    term: "Mixed cropping",
    category: "Cropping system",
    definition:
      "Planting two or more crops with no distinct rows or strips, sometimes called polyculture.",
  },
  {
    term: "Secondary crop",
    category: "Cropping system",
    definition:
      "The additional crop planted with the main crop in an intercropped field.",
  },

  // MAPPING / GIS
  {
    term: "Map layer",
    category: "Mapping",
    definition:
      "A set of map information that can be turned on or off, such as barangay boundaries, fields, or calamity reports.",
  },
  {
    term: "Basemap",
    category: "Mapping",
    definition:
      "The background map (satellite or street view) on which AgriGIS draws fields and other data.",
  },
  {
    term: "Polygon",
    category: "Mapping",
    definition:
      "A closed shape drawn on the map to represent the exact boundary of a field or area.",
  },
  {
    term: "Marker",
    category: "Mapping",
    definition:
      "A single point on the map, usually shown as a pin or icon, used for locations like calamity reports.",
  },

  // ANALYTICS
  {
    term: "Timeline filter",
    category: "Analytics",
    definition:
      "A control that limits which fields are visible on the map based on planted or harvested dates.",
  },
  {
    term: "Harvest history",
    category: "Analytics",
    definition:
      "A view or filter that shows fields harvested within a selected year and month range for trend analysis.",
  },

  // CALAMITY
  {
    term: "Calamity",
    category: "Calamity",
    definition:
      "A natural event such as typhoon, flood, drought, or pest outbreak that can damage crops and fields.",
  },
  {
    term: "Calamity report",
    category: "Calamity",
    definition:
      "A record describing the type of calamity, location, affected crops, and damage.",
  },
  {
    term: "Damage assessment",
    category: "Calamity",
    definition:
      "The process of estimating how much crop area or yield was lost due to a calamity.",
  },
  {
    term: "Severity level",
    category: "Calamity",
    definition:
      "A rating used in AgriGIS to describe how serious the impact of a calamity is on a field or barangay.",
  },

  // ROLES
  {
    term: "Admin",
    category: "Roles",
    definition:
      "A user from the Bago City Department of Agriculture who manages farmer records, crop tagging, and calamity data inside AgriGIS.",
  },
  {
    term: "Super Admin",
    category: "Roles",
    definition:
      "A higher-level user who can manage admin accounts, view city-wide statistics, and configure system settings.",
  },
  {
    term: "User map",
    category: "Roles",
    definition:
      "The farmer-facing map view where residents can see fields, crops, and calamity information.",
  },
  // ECOSYSTEMS
  {
    term: "Irrigated Rice Ecosystem",
    category: "Ecosystem",
    definition:
      "Rice fields that receive a regular water supply from irrigation canals, pumps, or other controlled water sources.",
  },
  {
    term: "Flooded Rice Fields",
    category: "Ecosystem",
    definition:
      "Rice areas that are intentionally kept flooded for most of the growing season to support rice growth and reduce weeds.",
  },
  {
    term: "Rainfed Rice",
    category: "Ecosystem",
    definition:
      "Rice fields that depend mainly on rainfall for water, with little or no irrigation support.",
  },
  {
    term: "Tropical Crop Ecosystem",
    category: "Ecosystem",
    definition:
      "Farming areas located in warm, tropical climates where crops like rice, corn, banana, and sugarcane are commonly grown.",
  },
  {
    term: "Agroforestry Ecosystem",
    category: "Ecosystem",
    definition:
      "A system where trees or woody plants are grown together with crops or livestock on the same land.",
  },
  {
    term: "Plantation Ecosystem",
    category: "Ecosystem",
    definition:
      "Large, usually commercial farms planted with a single main crop such as sugarcane, banana, or other high-value crops.",
  },
  {
    term: "Root Crop Ecosystem",
    category: "Ecosystem",
    definition:
      "Farming areas focused on root and tuber crops such as cassava, sweet potato, or yam.",
  },
  {
    term: "Rainfed Ecosystem",
    category: "Ecosystem",
    definition:
      "Farms that mainly rely on natural rainfall for water, with no permanent irrigation system.",
  },
  {
    term: "Tropical Farming Ecosystem",
    category: "Ecosystem",
    definition:
      "General term for farms located in tropical climates with year-round warm temperatures and distinct wet and dry seasons.",
  },
  {
    term: "Dryland Corn Ecosystem",
    category: "Ecosystem",
    definition:
      "Corn areas planted in drier conditions with limited or no irrigation, often depending on seasonal rains.",
  },
  {
    term: "Monoculture Ecosystem",
    category: "Ecosystem",
    definition:
      "Farmland where only one crop species is planted over a large area for one or more seasons.",
  },
  {
    term: "Field Crop Ecosystem",
    category: "Ecosystem",
    definition:
      "Open-field farms planted with crops like rice, corn, sugarcane, or other major field crops.",
  },
  {
    term: "Sugarcane Plantation Ecosystem",
    category: "Ecosystem",
    definition:
      "Large areas mainly planted with sugarcane for commercial sugar or biofuel production.",
  },
  {
    term: "Flooded or Irrigated Ecosystem",
    category: "Ecosystem",
    definition:
      "Crop areas that are regularly supplied with water through flooding or irrigation to support growth.",
  },

  // TENURE / LAND RIGHTS
  {
    term: "Owner",
    category: "Tenure",
    definition:
      "A farmer or individual who has legal ownership of the land being used for farming.",
  },
  {
    term: "Tenant Farmer",
    category: "Tenure",
    definition:
      "A farmer who uses land owned by someone else and usually pays rent in cash, labor, or a share of the harvest.",
  },
  {
    term: "Leasehold Farmer",
    category: "Tenure",
    definition:
      "A farmer who rents land from an owner under a formal or long-term lease agreement.",
  },
  {
    term: "Sharecropper (Kasama)",
    category: "Tenure",
    definition:
      "A farmer who works on another person’s land and shares an agreed portion of the harvest with the landowner.",
  },
  {
    term: "Farm Laborer",
    category: "Tenure",
    definition:
      "A person hired to work on a farm for wages, usually without rights to the land or harvest.",
  },
  {
    term: "Contract Grower",
    category: "Tenure",
    definition:
      "A farmer who produces crops under a contract with a company or buyer, often with agreed price and volume.",
  },
  {
    term: "Stewardship Farmer",
    category: "Tenure",
    definition:
      "A farmer allowed to use and manage land through a stewardship or management agreement, without full ownership.",
  },
  {
    term: "Agrarian Reform Beneficiary (ARB)",
    category: "Tenure",
    definition:
      "A farmer who received land through the government’s agrarian reform program, usually with specific rights and responsibilities.",
  },
  // CROPPING SYSTEM
  {
    term: "Cropping system",
    category: "Cropping system",
    definition:
      "The pattern or method of planting crops in a field, including monocrop and different types of intercropping.",
  },
  {
    term: "Monocrop",
    category: "Cropping system",
    definition:
      "A cropping system where only one type of crop is planted in a field during a season.",
  },
  {
    term: "Intercropped (2 crops)",
    category: "Cropping system",
    definition:
      "A field planted with two different crops at the same time or in overlapping periods, sharing the same area.",
  },
  {
    term: "Relay intercropping",
    category: "Cropping system",
    definition:
      "An intercropping method where a second crop is planted before the first crop is fully harvested, so their growth periods overlap.",
  },
  {
    term: "Strip intercropping",
    category: "Cropping system",
    definition:
      "Planting different crops in long strips within the same field so they can be managed separately but still interact.",
  },
  {
    term: "Mixed cropping / Polyculture",
    category: "Cropping system",
    definition:
      "Planting two or more crops mixed together without distinct rows or strips, often to maximize diversity and reduce risk.",
  },
  {
    term: "Secondary crop",
    category: "Cropping system",
    definition:
      "The additional crop planted with the main crop in an intercropped field.",
  },
];

/* -------------------------- categories for dropdown ------------------------- */
const ALL_CATEGORIES = [
  "All",
  "Analytics",
  "Calamity",
  "Crops",
  "Cropping system",
  "Ecosystem",
  "Farmer",
  "Mapping",
  "Roles",
  "System",
  "Tenure",
  "Cropping System",
];

/* ----------------------------- Pagination Button ---------------------------- */
const PageBtn = ({ disabled, onClick, children, aria }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    aria-label={aria}
    className={`px-2 py-1 border border-slate-300 rounded-md text-sm ${
      disabled
        ? "text-slate-400 cursor-not-allowed bg-slate-100"
        : "hover:bg-slate-50 text-slate-700"
    }`}
  >
    {children}
  </button>
);

/* ------------------------------- Main Component ----------------------------- */
const SuperAdminGlossary = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  // pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // sidebar collapsed state for SuperAdminNav
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let items = GLOSSARY_ITEMS.filter((item) => {
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesSearch = !q || item.term.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
    return [...items].sort((a, b) => a.term.localeCompare(b.term));
  }, [activeCategory, search]);

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);
  const isLoading = false;

  return (
    <div className="flex flex-col min-h-screen bg-white font-poppins">
      <SuperAdminNav onCollapsedChange={setSidebarCollapsed} />

      <main
        className={`ml-0 pt-8 md:pt-10 pr-0 md:pr-8 flex-grow transition-all duration-200 ${
          sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="mb-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-[32px] leading-tight font-bold text-slate-900">
                  Glossary
                </h1>
                <p className="text-[15px] text-slate-600">
                  View, search, and browse key terms used in the AgriGIS system.
                  Use the filters to quickly find definitions for crops, mapping,
                  calamities, and more.
                </p>
              </div>
            </div>

            {/* Tools row */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              {/* Category Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCategoryMenu((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {activeCategory === "All"
                      ? "All Terms"
                      : `${activeCategory} terms`}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 text-[11px] font-medium text-slate-600">
                    {total}
                  </span>
                  <svg
                    className={`h-4 w-4 text-slate-500 transition-transform ${
                      showCategoryMenu ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M6 8l4 4 4-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {showCategoryMenu && (
                  <div className="absolute z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {ALL_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setActiveCategory(cat);
                          setShowCategoryMenu(false);
                          setPage(1);
                        }}
                        className={`block w-full px-3 py-1.5 text-left text-sm ${
                          activeCategory === cat
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {cat === "All" ? "All terms" : cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="flex items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    Search
                  </span>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xs">
                      🔍︎
                    </div>
                    <input
                      id="glossary-search"
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by term…"
                      className="h-10 w-[min(18rem,80vw)] sm:w-72 rounded-full border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          {paginated.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
              No terms found. Try a different keyword or clear the filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[minmax(0,0.35fr)_minmax(0,1.65fr)] items-center border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div>Name</div>
                <div>Description</div>
              </div>

              <div className="divide-y divide-slate-200">
                {paginated.map((item) => (
                  <div
                    key={item.term}
                    className="grid grid-cols-[minmax(0,0.35fr)_minmax(0,1.65fr)] items-start px-6 py-3 text-sm hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-emerald-700 font-medium cursor-default">
                        {item.term}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {item.category}
                      </div>
                    </div>
                    <div className="text-slate-700 text-sm leading-relaxed">
                      {item.definition}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && total > 0 && (
            <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-slate-600">
                Showing{" "}
                <span className="font-medium">
                  {total === 0 ? 0 : start + 1}
                </span>
                {"–"}
                <span className="font-medium">
                  {Math.min(start + pageSize, total)}
                </span>{" "}
                of <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-3">
                <select
                  className="border border-slate-300 px-2 py-1 rounded-md"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[8, 12, 16, 24].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>

                <div className="inline-flex items-center gap-1">
                  <PageBtn
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    aria="First"
                  >
                    «
                  </PageBtn>
                  <PageBtn
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria="Previous"
                  >
                    ‹
                  </PageBtn>
                  <span className="px-3 text-sm text-slate-700">
                    Page {page} of {totalPages}
                  </span>
                  <PageBtn
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria="Next"
                  >
                    ›
                  </PageBtn>
                  <PageBtn
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    aria="Last"
                  >
                    »
                  </PageBtn>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <div
        className={`mt-5 ml-0 transition-all duration-200 ${
          sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"
        }`}
      >
        <Footer />
      </div>
    </div>
  );
};

export default SuperAdminGlossary;
