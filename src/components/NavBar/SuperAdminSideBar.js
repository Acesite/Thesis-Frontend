// src/components/NavBar/SuperAdminNav.js
import React, { useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Users2,
  CloudLightning,
  Sprout,
  BookText,
  BarChart3,
  Archive,
  LogOut,
  User as UserIcon,
  ChevronLeft,
  Menu,
} from "lucide-react";

const SuperAdminSideBar = ({ onCollapsedChange }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(
    localStorage.getItem("first_name") || ""
  );
  const [lastName, setLastName] = useState(
    localStorage.getItem("last_name") || ""
  );
  const [email, setEmail] = useState(localStorage.getItem("email") || "");

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [adminProfile, setAdminProfile] = useState({
    first_name: firstName,
    last_name: lastName,
    email: email,
  });

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // collapsible state
  const [collapsed, setCollapsed] = useState(false);
  // popover for collapsed avatar
  const [collapsedProfileMenuOpen, setCollapsedProfileMenuOpen] =
    useState(false);

  // helper to update collapsed + notify parent
  const setCollapsedAndNotify = (value) => {
    setCollapsed(value);
    if (typeof onCollapsedChange === "function") {
      onCollapsedChange(value);
    }
  };

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) return;

    axios
      .get(`http://localhost:5000/api/profile/${id}`)
      .then(({ data }) => {
        const fn = data.first_name ?? "";
        const ln = data.last_name ?? "";
        const em = data.email ?? data.user?.email ?? "";

        setFirstName(fn);
        setLastName(ln);
        setEmail(em);

        setAdminProfile({ first_name: fn, last_name: ln, email: em });

        localStorage.setItem("first_name", fn);
        localStorage.setItem("last_name", ln);
        if (em) localStorage.setItem("email", em);
      })
      .catch((err) => {
        console.error("Failed to fetch profile:", err);
        setAdminProfile({
          first_name: localStorage.getItem("first_name") || "",
          last_name: localStorage.getItem("last_name") || "",
          email: localStorage.getItem("email") || "",
        });
      });
  }, []);

  // keep modal fields in sync
  useEffect(() => {
    if (showProfileModal) {
      setAdminProfile({ first_name: firstName, last_name: lastName, email });
    }
  }, [showProfileModal, firstName, lastName, email]);

  // close collapsed menu when expanding sidebar
  useEffect(() => {
    if (!collapsed) setCollapsedProfileMenuOpen(false);
  }, [collapsed]);

  // initial notify
  useEffect(() => {
    if (typeof onCollapsedChange === "function") {
      onCollapsedChange(collapsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials =
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "SA";

  const onSaveProfile = async () => {
    try {
      const id = localStorage.getItem("user_id");

      if (password && password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
      }

      const payload = {
        first_name: adminProfile.first_name,
        last_name: adminProfile.last_name,
        email: adminProfile.email,
      };
      if (password.trim()) payload.password = password;

      await axios.put(`http://localhost:5000/api/profile/${id}`, payload);

      setFirstName(adminProfile.first_name);
      setLastName(adminProfile.last_name);
      setEmail(adminProfile.email);

      localStorage.setItem("first_name", adminProfile.first_name);
      localStorage.setItem("last_name", adminProfile.last_name);
      localStorage.setItem("email", adminProfile.email);

      alert("Profile updated successfully.");
      setShowProfileModal(false);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    }
  };

  const onLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const navLinkBase =
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    isActive(path)
      ? `${navLinkBase} bg-emerald-50 text-emerald-700`
      : `${navLinkBase} text-slate-700 hover:bg-slate-50`;

  const iconClass = (path) =>
    isActive(path) ? "w-4 h-4 text-emerald-600" : "w-4 h-4 text-slate-400";

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-slate-200 shadow-sm font-poppins transition-all duration-200 ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        {/* Top area: logo / burger / collapse button */}
        {collapsed ? (
          <div className="px-3 pt-4 pb-3">
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setCollapsedAndNotify(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                title="Expand sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-3 pt-4 pb-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <img
                  src="/images/AgriGIS.png"
                  alt="AgriGIS"
                  className="h-8 w-auto"
                />
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-semibold text-slate-900">
                    AgriGIS
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Bago City · Super Admin
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCollapsedAndNotify(true)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="mt-4 flex-1 px-3 space-y-1 overflow-y-auto pb-4">
          {!collapsed && (
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Main
            </div>
          )}

          <Link
            to="/ManageAccount"
            className={
              linkClass("/ManageAccount") +
              (collapsed ? " justify-center px-0" : "")
            }
            title={collapsed ? "Manage Account" : undefined}
          >
            <Users2 className={iconClass("/ManageAccount")} />
            {!collapsed && <span>Manage Account</span>}
          </Link>

          <Link
            to="/SuperAdminManageCalamity"
            className={
              linkClass("/SuperAdminManageCalamity") +
              (collapsed ? " justify-center px-0" : "")
            }
            title={collapsed ? "Calamity" : undefined}
          >
            <CloudLightning
              className={iconClass("/SuperAdminManageCalamity")}
            />
            {!collapsed && <span>Calamity</span>}
          </Link>

          <Link
            to="/SuperAdminManageCrop"
            className={
              linkClass("/SuperAdminManageCrop") +
              (collapsed ? " justify-center px-0" : "")
            }
            title={collapsed ? "Crops" : undefined}
          >
            <Sprout className={iconClass("/SuperAdminManageCrop")} />
            {!collapsed && <span>Crops</span>}
          </Link>

          <Link
            to="/SuperAdminGlossary"
            className={
              linkClass("/SuperAdminGlossary") +
              (collapsed ? " justify-center px-0" : "")
            }
            title={collapsed ? "Glossary" : undefined}
          >
            <BookText className={iconClass("/SuperAdminGlossary")} />
            {!collapsed && <span>Glossary</span>}
          </Link>

          <Link
            to="/Graphs"
            className={
              linkClass("/Graphs") + (collapsed ? " justify-center px-0" : "")
            }
            title={collapsed ? "Graphs" : undefined}
          >
            <BarChart3 className={iconClass("/Graphs")} />
            {!collapsed && <span>Graphs</span>}
          </Link>

          <Link
            to="/SuperAdminArchive"
            className={
              linkClass("/SuperAdminArchive") +
              (collapsed ? " justify-center px-0" : "")
            }
            title={collapsed ? "Archives" : undefined}
          >
            <Archive className={iconClass("/SuperAdminArchive")} />
            {!collapsed && <span>Archives</span>}
          </Link>
        </nav>

        {/* Bottom: profile area */}
        <div className="px-3 pb-4">
          {collapsed ? (
            // Collapsed: plain avatar with popover menu, no grey card
            <div className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() =>
                  setCollapsedProfileMenuOpen((open) => !open)
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-sm"
                title="Profile & Logout"
              >
                {initials}
              </button>

              {collapsedProfileMenuOpen && (
                <div className="absolute bottom-12 w-40 rounded-md border border-slate-200 bg-white shadow-lg text-xs overflow-hidden">
                  <button
                    onClick={() => {
                      setCollapsedProfileMenuOpen(false);
                      setShowProfileModal(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setCollapsedProfileMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 border-t border-slate-100 hover:bg-rose-50 text-rose-700"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Expanded: full profile block with card
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-semibold">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-[11px] text-slate-500">
                    Signed in as
                  </span>
                  <span className="text-[13px] font-semibold text-slate-900 truncate">
                    {firstName || "Super Admin"} {lastName}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">
                    {email || "superadmin@gmail.com"}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Profile</span>
                </button>
                <button
                  onClick={onLogout}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-700 hover:bg-emerald-100"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
              aria-label="Close"
            >
              &times;
            </button>

            <h2 className="mb-4 text-lg font-semibold text-emerald-700">
              Admin Profile
            </h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  First name
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={adminProfile.first_name}
                  onChange={(e) =>
                    setAdminProfile((p) => ({
                      ...p,
                      first_name: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Enter your first name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Last name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={adminProfile.last_name}
                  onChange={(e) =>
                    setAdminProfile((p) => ({
                      ...p,
                      last_name: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Enter your last name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={adminProfile.email}
                  onChange={(e) =>
                    setAdminProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Enter your email address"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  New password
                </label>
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Confirm new password
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Re-enter new password"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowProfileModal(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={onSaveProfile}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SuperAdminSideBar;
