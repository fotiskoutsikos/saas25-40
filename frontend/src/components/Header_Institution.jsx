import React from 'react';
import logo from '../assets/logo_clearSKY.png';
import './Header_Institution.css';
import './textStyles.css';
import { NavLink } from 'react-router-dom';

export default function Header_Institution() {
  return (
    <div className="header-container">
      <img src={logo} alt="clearSKY Logo" className="header-logo" />

      <div className="header-bar">
        <div className="header-nav">
          <NavLink
            to="/institution"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Institution
          </NavLink>
          <NavLink
            to="/institutionstatistics"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Statistics
          </NavLink>
          <NavLink
            to="/institutioncredits"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Credits
          </NavLink>
          <NavLink
            to="/institutionaccounts"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Accounts
          </NavLink>
          <NavLink
            to="/institutionmanagement"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            User Management
          </NavLink>
          <NavLink
            to="/"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Disconnect
          </NavLink>
        </div>
      </div>
    </div>
  );
}
