import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';

import InstitutionRegister from './pages/InstitutionRegister';
import InstitutionCredits from './pages/InstitutionCredits';
import InstitutionAccounts from './pages/InstitutionAccounts';
import InstitutionStatistics from './pages/InstitutionStatistics';

import TeacherInitialGrades from './pages/TeacherInitialGrades';
import TeacherFinalGrades from './pages/TeacherFinalGrades';
import TeacherMyCourses from './pages/TeacherMyCourses';
import TeacherStatistics from './pages/TeacherStatistics';
import TeacherRequests from './pages/TeacherRequests';

import StudentStatistics from './pages/StudentStatistics';
import StudentMyGrades from './pages/StudentMyGrades';
import UserManagement from './pages/UserManagementStudent';
import UserManagementStudent from './pages/UserManagementStudent';
import UserManagementTeacher from './pages/UserManagementTeacher';
import UserManagementInstitution from './pages/UserManagementInstitution';
import './index.css';

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/institution" element={<InstitutionRegister />} />
        <Route path="/institutioncredits" element={<InstitutionCredits />} />
        <Route path="/institutionaccounts" element={<InstitutionAccounts />} />
        <Route path="/institutionstatistics" element={<InstitutionStatistics />} />
        <Route path="/institutionmanagement" element={<UserManagementInstitution />} />

        <Route path="/teacherinitialgrades" element={<TeacherInitialGrades />} />
        <Route path="/teacherfinalgrades" element={<TeacherFinalGrades />} />
        <Route path="/teachermycourses" element={<TeacherMyCourses />} />
        <Route path="/teacherstatistics" element={<TeacherStatistics />} />
        <Route path="/teacherrequests" element={<TeacherRequests />} />
        <Route path="/teachermanagement" element={<UserManagementTeacher />} />

        <Route path="/studentstatistics" element={<StudentStatistics />} />
        <Route path="/studentmygrades" element={<StudentMyGrades />} />
        <Route path="/studentmanagement" element={<UserManagementStudent />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
