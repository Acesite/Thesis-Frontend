// src/components/ManageAccount/ManageAccount.js
import React, { useEffect, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import axios from "axios";
import SuperAdminNav from "../NavBar/SuperAdminSideBar";
import Footer from "../LandingPage/Footer";
import AccountsTable from "./AccountsTable";
import PageContainer from "./PageContainer";

const ManageAccount = () => {
  const [accounts, setAccounts] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    AOS.init({ duration: 1000, once: true });
    axios
      .get("http://localhost:5000/manageaccount/accounts")
      .then((res) => setAccounts(res.data))
      .catch((err) => console.error("Error fetching accounts:", err));
  }, []);

  const handleDelete = (id) =>
    setAccounts((prev) => prev.filter((a) => a.id !== id));

  const handleUpdateStatus = (id, status) =>
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );

  return (
    <div className="min-h-screen bg-white font-poppins flex">
      {/* Sidebar */}
      <SuperAdminNav onCollapsedChange={setSidebarCollapsed} />

      {/* Main content area (shifted right of sidebar) */}
      <div
        className={`flex flex-col flex-1 transition-all duration-200 ${
          sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"
        }`}
      >
        <main className="flex-grow pt-8 pb-10 px-4 md:px-8">
          <PageContainer>
            <h2 className="mb-6 text-center text-3xl font-bold text-green-600 md:text-4xl">
              Manage Accounts
            </h2>

            <AccountsTable
              accounts={accounts}
              onDelete={handleDelete}
              onUpdateStatus={handleUpdateStatus}
            />
          </PageContainer>
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default ManageAccount;
