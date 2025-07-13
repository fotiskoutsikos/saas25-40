import React from 'react';
import logo from '../assets/logo_clearSKY.png'; // adjust path if needed
import './Header_Login.css'; // custom CSS if needed
import './textStyles.css'

export default function Header_Login() {
  return (
    <div className="header-container text-header-login">
      <img src={logo} alt="clearSKY Logo" className="header-logo" />
      <div className="header-bar">
        Welcome to clearSKY: grades, statistics & more
      </div>
    </div>
  );
}
