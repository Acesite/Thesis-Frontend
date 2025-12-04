// components/MapControls/Button.jsx
import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

const styles = {
  base:
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 " +
    "disabled:opacity-50 disabled:cursor-not-allowed",
  size: {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
  },
  variant: {
    solid: "bg-emerald-600 text-white hover:bg-emerald-700",
    outline:
      "border border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white",
    subtle:
      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100",
  },
};

export default function Button({
  to,
  children,
  className,
  variant = "outline",
  size = "md",
  iconLeft,
  iconRight,
  ...props
}) {
  const Comp = to ? Link : "button";
  return (
    <Comp
      to={to}
      className={clsx(styles.base, styles.size[size], styles.variant[variant], className)}
      {...props}
    >
      {iconLeft && <span className="mr-2">{iconLeft}</span>}
      {children}
      {iconRight && <span className="ml-2">{iconRight}</span>}
    </Comp>
  );
}
