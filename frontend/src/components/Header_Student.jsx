import React from 'react';
import logo from '../assets/logo_clearSKY.png';
import './Header.css';
import './textStyles.css';
import { NavLink } from 'react-router-dom';


export default function Header_Student() {
  return (
    <div className="header-container">
      <img src={logo} alt="clearSKY Logo" className="header-logo" />
      
    
      <div className="header-bar">
      <div className="header-nav">
      <NavLink 
            to="/studentmygrades" 
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            My Grades
          </NavLink>
      <NavLink 
            to="/studentstatistics" 
            className={({ isActive }) => "nav-button text-heading-md" + (isActive ? " active" : "")}
          >
            Statistics
          </NavLink>
        <NavLink 
            to="/studentmanagement" 
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