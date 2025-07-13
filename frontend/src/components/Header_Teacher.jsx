import React from 'react';
import logo from '../assets/logo_clearSKY.png';
import './Header.css';
import './textStyles.css';
import { NavLink } from 'react-router-dom';

export default function Header_Teacher() {
  return (
    <div className="header-container">
      <img src={logo} alt="clearSKY Logo" className="header-logo" />

      <div className="header-bar">
        <div className="header-nav">
          <NavLink
            to="/teacherinitialgrades"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Initial Grades
          </NavLink>
          <NavLink
            to="/teacherfinalgrades"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Final Grades
          </NavLink>
          <NavLink
            to="/teacherrequests"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Requests
          </NavLink>
          <NavLink
            to="/teachermycourses"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Courses
          </NavLink>
          <NavLink
            to="/teacherstatistics"
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Statistics
          </NavLink>
          <NavLink
            to="/teachermanagement"
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