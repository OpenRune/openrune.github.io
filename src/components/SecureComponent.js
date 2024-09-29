import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyUserToken } from "src/api/apiService";

export default function SecureContent({ children, fallback }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthentication = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      const isValid = await verifyUserToken(token);

      setIsAuthenticated(isValid);
      setLoading(false);
    };

    checkAuthentication();
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>; // You can replace this with a spinner or loading component
  }

  if (isAuthenticated) {
    return <>{children}</>; // Render the protected content if authenticated
  }

  // Render fallback content or perform an action if not authenticated
  return <>{fallback}</>;
}
