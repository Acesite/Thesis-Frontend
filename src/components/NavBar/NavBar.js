import React from "react";
import { useLocation } from "react-router-dom";
import { Link } from 'react-router-dom';
import { Map as MapIcon } from "lucide-react";

const NavBar = () => {
  const location = useLocation();
  return (
    <header className="w-full bg-white shadow-md fixed top-0 left-0 z-50 font-poppins">
      <div className="container mx-auto flex items-center justify-between py-4 px-6">
        {/* Logo */}
        <div className="flex items-start ml-[159px]">
          <img src="/images/AgriGIS.png" alt="Lander Logo" className="h-[50px] w-auto" />
        </div>

        {/* Navigation + Login Container */}
        <div className="flex items-center space-x-6 ml-auto">
          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-6">
      <a
        href="/"
        className={`tracking-wide font-light hover:text-green-700 ${
          location.pathname === "/" ? "text-green-700 font-medium" : "text-black-600"
        }`}
      >
        Home
      </a>
      <a
        href="/AboutUs"
        className={`tracking-wide font-light hover:text-green-700 ${
          location.pathname === "/AboutUs" ? "text-green-700 font-medium" : "text-black-600"
        }`}
      >
        About
      </a>
      <a
        href="/Contact"
        className={`tracking-wide font-light hover:text-green-700 ${
          location.pathname === "/Contact" ? "text-green-700 font-medium" : "text-black-600"
        }`}
      >
        Contacts
      </a>
    </nav>

    {/* Explore button */}
          <Link to="/ChooseMap" className="hidden md:inline-flex">
            <button
              className="relative inline-flex items-center justify-center px-3.5 py-2.5 overflow-hidden font-medium text-white transition duration-300 ease-out border-2 border-emerald-600 rounded-xl shadow-md group"
            >
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

          {/* CTA Buttons */}
          <Link to="/Signup">
  <button class="relative inline-block group">
    <span class="relative z-10 px-3.5 py-2 overflow-hidden font-medium leading-tight flex items-centrer justify-center text-green-600 transition-colors duration-300 ease-out border-2 border-green-600 rounded-lg group-hover:text-white">
      <span class="absolute inset-0 w-full h-full px-5 py-3 rounded-lg bg-gray-50"></span>
      <span class="absolute left-0 w-40 h-40 -ml-2 transition-all duration-300 origin-top-right -rotate-90 -translate-x-full translate-y-12 bg-green-600 group-hover:-rotate-180 ease"></span>
      <span class="relative text-base font-poppins">Register</span>
    </span>
    <span class="absolute bottom-0 right-0 w-full h-9 -mb-1 -mr-1 transition-all duration-200 ease-linear bg-green-600 rounded-lg group-hover:mb-0 group-hover:mr-0 group-hover:mb-2" data-rounded="rounded-lg"></span>
  </button>
</Link>

<Link to="/ChooseRoleLogin">
<button class="relative inline-block group mr-[130px]">
<span
class="relative z-10 px-3.5 py-2 overflow-hidden font-medium leading-tight flex items-centrer justify-center text-green-600 transition-colors duration-300 ease-out border-2 border-green-600 rounded-lg group-hover:text-white">
<span class="absolute inset-0 w-full h-full px-5 py-3 rounded-lg bg-gray-50"></span>
<span
  class="absolute left-0 w-40 h-40 -ml-2 transition-all duration-300 origin-top-right -rotate-90 -translate-x-full translate-y-12 bg-green-600 group-hover:-rotate-180 ease"></span>
<span class="relative text-base font-poppins">Login</span>
</span>
<span
class="absolute bottom-0 right-0 w-full h-9 -mb-1 -mr-1 transition-all duration-200 ease-linear bg-green-600 rounded-lg group-hover:mb-0 group-hover:mr-0 group-hover:mb-2"
data-rounded="rounded-lg"></span>
</button>
</Link>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden text-gray-600 focus:outline-none">
          {/* Add a menu icon here */}
        </button>
      </div>
    </header>
  );
};

export default NavBar;
