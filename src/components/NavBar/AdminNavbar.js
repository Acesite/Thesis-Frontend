// components/AdminNavBar.jsx
import React, { useEffect, useRef, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Map as MapIcon } from "lucide-react";
import AdminProfileForm from "../AdminCrop/AdminProfileForm";

function AvatarButton({ profilePicture, initials, onClick }) {
  const [imgError, setImgError] = React.useState(false);

  const API_BASE =
    (import.meta?.env && import.meta.env.VITE_API_URL) ||
    process.env.REACT_APP_API_URL ||
    "http://localhost:5000";

  const normalizeUploadPath = (p) => {
    let s = p.replace(/\\/g, "/").trim();
    s = s.replace(/^\.?\/*/, "");
    s = s.replace(/^public\//i, "");
    if (s.startsWith("uploads/")) return `/${s}`;
    if (s.startsWith("/uploads/")) return s;
    if (!s.includes("/")) return `/uploads/${s}`;
    return s.startsWith("/") ? s : `/${s}`;
  };

  const buildSrc = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return "";
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(v)) return v;
    if (!v.includes("/") && /^[A-Za-z0-9+/=]+$/.test(v) && v.length >= 50) {
      return `data:image/jpeg;base64,${v}`;
    }
    if (/^https?:\/\//i.test(v)) return v;
    const rel = normalizeUploadPath(v);
    return `${API_BASE}${rel}`;
  };

  const src = buildSrc(profilePicture);

  React.useEffect(() => {
    setImgError(false);
  }, [profilePicture]);

  return (
    <button
      onClick={onClick}
      type="button"
      aria-label="Open user menu"
      className="h-10 w-10 overflow-hidden rounded-full ring-1 ring-gray-200 transition hover:ring-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
    >
      {src && !imgError ? (
        <img
          src={src}
          alt="Profile"
          className="h-full w-full object-cover"
          onError={() => {
            console.log("[Avatar] failed to load:", src, "raw:", profilePicture);
            setImgError(true);
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-emerald-600 text-sm font-semibold text-white">
          {initials || "U"}
        </div>
      )}
    </button>
  );
}

const IconUser = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    {...props}
  >
    <path d="M20 21a8 8 0 1 0-16 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconLogout = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    {...props}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

const MenuItem = React.forwardRef(({ children, icon, onClick, to }, ref) => {
  const base =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none";
  if (to) {
    return (
      <Link ref={ref} to={to} className={base} role="menuitem" onClick={onClick}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button
      ref={ref}
      type="button"
      className={base}
      role="menuitem"
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
});

const AdminNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const firstName = localStorage.getItem("first_name") || "";
  const lastName = localStorage.getItem("last_name") || "";
  const email = localStorage.getItem("email") || "";

  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [adminProfile, setAdminProfile] = useState({
    first_name: firstName,
    last_name: lastName,
    email,
    profile_picture: localStorage.getItem("profile_picture") || "",
  });

  const dropdownRef = useRef(null);
  const firstItemRef = useRef(null);

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  useEffect(() => {
    function onDocClick(e) {
      if (!dropdownRef.current?.contains(e.target)) setShowDropdown(false);
    }
    function onKey(e) {
      if (!showDropdown) return;
      if (e.key === "Escape") setShowDropdown(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        firstItemRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showDropdown]);

  useEffect(() => {
    if (showDropdown) {
      setTimeout(() => firstItemRef.current?.focus(), 0);
    }
  }, [showDropdown]);

  function handleLogout() {
    localStorage.removeItem("user_id");
    localStorage.removeItem("first_name");
    localStorage.removeItem("last_name");
    localStorage.removeItem("email");
    localStorage.removeItem("profile_picture");
    navigate("/");
  }

  return (
    <header className="fixed left-0 top-0 z-50 w-full bg-white shadow-md">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="ml-[159px] flex items-start">
          <img
            src="/images/AgriGIS.png"
            alt="AgriGIS"
            className="h-[50px] w-auto"
          />
        </div>

        {/* Center area: nav links + Explore button */}
        <div className="ml-auto flex items-center space-x-6">
          {/* Nav links */}
          <nav className="hidden space-x-6 md:flex">
            <a
              href="/AdminLanding"
              className={`tracking-wide font-light hover:text-emerald-700 ${
                location.pathname === "/AdminLanding"
                  ? "text-emerald-700 font-medium"
                  : "text-gray-800"
              }`}
            >
              Home
            </a>

            <a
              href="/AdminManageCrop"
              className={`tracking-wide font-light hover:text-emerald-700 ${
                location.pathname === "/AdminManageCrop"
                  ? "text-emerald-700 font-medium"
                  : "text-gray-800"
              }`}
            >
              Crops
            </a>

            <a
              href="/AdminManageCalamity"
              className={`tracking-wide font-light hover:text-emerald-700 ${
                location.pathname === "/AdminManageCalamity"
                  ? "text-emerald-700 font-medium"
                  : "text-gray-800"
              }`}
            >
              Calamity
            </a>

            <a
              href="/AdminGlossary"
              className={`tracking-wide font-light hover:text-emerald-700 ${
                location.pathname === "/AdminGlossary"
                  ? "text-emerald-700 font-medium"
                  : "text-gray-800"
              }`}
            >
              Glossary
            </a>
          </nav>

          {/* Explore button */}
          <Link to="/UnifiedAgriMap" className="hidden md:inline-flex">
            <button className="relative inline-flex items-center justify-center px-3.5 py-2.5 overflow-hidden font-medium text-white transition duration-300 ease-out border-2 border-emerald-600 rounded-xl shadow-md group">
              <span className="absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 -translate-x-full bg-green-500 group-hover:translate-x-0 ease">
                <MapIcon className="w-5 h-5" />
              </span>
              <span className="absolute flex items-center text-sm font-semibold justify-center w-full h-full text-emerald-700 transition-all duration-300 transform bg-white group-hover:translate-x-full ease tracking-widest">
                Explore
              </span>
              <span className="relative text-sm font-semibold invisible">
                Button Text
              </span>
            </button>
          </Link>
        </div>

        {/* Avatar, greeting, visible name/email & dropdown */}
        <div className="relative ml-4 mr-8" ref={dropdownRef}>
          <div className="flex items-center gap-2">
            <AvatarButton
              profilePicture={adminProfile.profile_picture}
              initials={initials}
              onClick={() => setShowDropdown((s) => !s)}
            />
            {/* Greeting block – smaller and truncated */}
            <div className="hidden md:flex flex-col leading-tight max-w-[170px]">
              <span className="text-[11px] text-gray-500">Hi!</span>
              <span className="text-[13px] font-semibold text-gray-900 truncate">
                {firstName || "Admin"} {lastName}
              </span>
              <span className="hidden lg:block text-[11px] text-gray-500 truncate">
                {email || "superadmin@bago.gov"}
              </span>
            </div>
          </div>

          {showDropdown && (
            <div
              role="menu"
              aria-label="User menu"
              className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-gray-100 bg-white p-2 shadow-lg ring-1 ring-black/5 transition animate-[fadeIn_.12s_ease-out]"
              style={{ transformOrigin: "top right" }}
            >
              <div className="absolute -top-1 right-4 h-2 w-2 rotate-45 rounded-sm bg-white ring-1 ring-gray-100" />

             

              <div className="my-2 h-px bg-gray-100" />

              <MenuItem
                ref={firstItemRef}
                icon={<IconUser />}
                onClick={() => {
                  setShowDropdown(false);
                  setShowProfileModal(true);
                }}
              >
                Profile
              </MenuItem>

              <MenuItem
                icon={<IconLogout />}
                onClick={() => {
                  setShowDropdown(false);
                  handleLogout();
                }}
              >
                Logout
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {showProfileModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="mb-4 text-xl font-semibold text-emerald-700">
              Admin Profile
            </h2>

            <AdminProfileForm
              onClose={() => {
                setAdminProfile({
                  first_name: localStorage.getItem("first_name") || "",
                  last_name: localStorage.getItem("last_name") || "",
                  email: localStorage.getItem("email") || "",
                  profile_picture:
                    localStorage.getItem("profile_picture") || "",
                });
                setShowProfileModal(false);
              }}
            />
          </div>
        </div>
      )}
    </header>
  );
};

export default AdminNavBar;
