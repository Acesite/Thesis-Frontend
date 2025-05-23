import React, { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

const FeatureCard = ({ icon: Icon, title, description }) => {
  useEffect(() => {
    AOS.init({ duration: 1000, once: true });
  }, []);

  return (
    <div
      className="flex flex-col items-center text-center bg-gray-100 p-6 rounded-2xl shadow-md 
                 transition-all duration-5000 ease-in-out hover:shadow-xl hover:-translate-y-3 hover:scale-205"
      data-aos="zoom-in"
    >
      <Icon className="w-10 h-10 text-green-500 mb-5 transition-all duration-75 ease-in-out group-hover:rotate-12 stroke-[1.5]" />
      <h3 className="text-xl font-normal mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};

export default FeatureCard;
