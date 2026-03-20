import React from "react";
import { FaFacebook, FaTwitter, FaDiscord } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="bg-gray-200 text-green-900 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap justify-between items-center">

          {/* ── Left Section — Logo + System Name ── */}
          <div className="mb-4 md:mb-0 flex items-center gap-3">
           
            <div>
              <p className="text-green-900 font-black text-xl tracking-wide leading-none">
                VISTA
              </p>
              <p className="text-gray-600 text-xs mt-0.5 leading-snug max-w-[200px]">
                Vote – Voter Insights &amp; Spatial Tracking Analytics
              </p>
            </div>
          </div>

          {/* ── Center Section — Quick Links ── */}
          <div className="mb-4 md:mb-0">
            <h3 className="text-lg font-medium">Quick Links</h3>
            <ul className="mt-2 space-y-1">
              <li><a href="#" className="text-gray-600 hover:text-black text-sm transition">Home</a></li>
              <li><a href="#" className="text-gray-600 hover:text-black text-sm transition">About</a></li>
              <li><a href="#" className="text-gray-600 hover:text-black text-sm transition">Services</a></li>
              <li><a href="#" className="text-gray-600 hover:text-black text-sm transition">Contact</a></li>
            </ul>
          </div>

          {/* ── Right Section — Social ── */}
          <div>
            <h3 className="text-lg font-medium">Follow Us</h3>
            <div className="flex space-x-4 mt-2">
              <a href="#" className="text-gray-600 hover:text-black transition">
                <FaFacebook className="text-xl" />
              </a>
              <a href="#" className="text-gray-600 hover:text-black transition">
                <FaTwitter className="text-xl" />
              </a>
              <a href="#" className="text-gray-600 hover:text-black transition">
                <FaDiscord className="text-xl" />
              </a>
            </div>
          </div>

        </div>

        {/* ── Bottom — Copyright ── */}
        <div className="mt-6 pt-4 border-t border-gray-300 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} <span className="font-semibold text-green-900">VISTA</span> — Vote – Voter Insights &amp; Spatial Tracking Analytics. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;