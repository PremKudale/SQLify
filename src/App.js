import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SQLEditorPage from './components/SQLEditorPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import HomePage from './components/HomePage';
import GamePage from './components/GamePage';
import SyntheticDataPage from './components/SyntheticDataPage';
import Schema from './components/Schema';
import { SessionProvider } from './SessionContext';
import PrivateRoute from './PrivateRoute';
import AboutUsPage from './components/AboutUsPage';

const App = () => {
  return (
    <SessionProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/about" element={<AboutUsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* Protected routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/homePage" element={<HomePage />} />
          <Route path="/sql-editor" element={<SQLEditorPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/schema" element={<Schema />} />
          <Route path="/synthetic-data" element={<SyntheticDataPage />} />
        </Route>

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </SessionProvider>
  );
};

export default App;