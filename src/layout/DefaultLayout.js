import React from 'react';
import { AppContent, AppSidebar, AppHeader } from '../components/index';
import MapViewer from "src/views/MapViewer";
import { useLocation } from "react-router-dom";

const DefaultLayout = () => {
  const location = useLocation(); // Get the current location
  const isMapView = location.pathname === '/MapViewer'; // Check if the current path is /MapViewer

  return (
    <div>
      <AppSidebar forceUnfoldable={isMapView} />
      <AppHeader removeMargins={isMapView} />
      <div className={`wrapper d-flex flex-column min-vh-100`}>
        <div className="body flex-grow-1">
          {isMapView ? <MapViewer /> : <AppContent />} {/* Render MapViewer or AppContent based on the path */}
        </div>
      </div>
    </div>
  );
};

export default DefaultLayout;
