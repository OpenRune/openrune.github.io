import React, { useEffect } from 'react';
import { AppContent, AppSidebar, AppHeader } from '../components/index';
import MapViewer from 'src/views/MapViewer';
import { useLocation } from 'react-router-dom';
import routes from "src/routes";

const DefaultLayout = () => {
  const location = useLocation();
  const { pathname, search } = location;

  const isMapView = pathname === '/MapViewer';
  const isEmbedView = pathname === '/widget';

  const query = new URLSearchParams(search);
  const type = query.get('type');
  const styleOverride = query.get('style');

  // 👇 Dynamically inject CSS based on `style` query param
  useEffect(() => {
    if (!styleOverride) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/styles/${styleOverride}.css`;
    link.id = 'dynamic-style';

    const oldLink = document.getElementById('dynamic-style');
    if (oldLink) oldLink.remove();

    document.head.appendChild(link);

    return () => {
      link.remove(); // Clean up on unmount or param change
    };
  }, [styleOverride]);

  const renderWidgetView = () => {
    const widgetRoute = routes.find(
      (route) =>
        route.isWidget &&
        (route.path.includes(type) || route.name.toLowerCase() === type.toLowerCase())
    );

    if (widgetRoute && widgetRoute.element) {
      const WidgetComponent = widgetRoute.element;
      return <WidgetComponent />;
    }

    return (
      <div>
        <h1>Missing Widget</h1>
        <p>Can't find widget: {type}</p>
      </div>
    );
  };

  return (
    <div>
      {!isEmbedView && <AppSidebar forceUnfoldable={isMapView} />}
      {!isEmbedView && <AppHeader removeMargins={isMapView} />}
      <div className="wrapper d-flex flex-column min-vh-100">
        <div className="body flex-grow-1">
          {isEmbedView ? renderWidgetView() : isMapView ? <MapViewer /> : <AppContent />}
        </div>
      </div>
    </div>
  );
};

export default DefaultLayout;
