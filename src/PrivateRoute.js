import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContext';

const PrivateRoute = () => {
  const { session, isLoading } = useSession();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // If user is not authenticated, redirect to login page
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If user is authenticated, render the child routes
  return <Outlet />;
};

export default PrivateRoute;
