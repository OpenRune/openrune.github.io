import React, { createContext, useState, useContext } from 'react';
import { CAlert } from '@coreui/react';

const AlertContext = createContext();

export const useAlert = () => useContext(AlertContext);

export const AlertProviderWithDisplay = ({ children }) => {
  const [alerts, setAlerts] = useState([]);

  const addAlert = (message, color = 'info', timeout = 5000) => {
    const id = Date.now();
    setAlerts([...alerts, { id, message, color }]);

    // Automatically remove the alert after the timeout
    setTimeout(() => fadeOutAlert(id), timeout);
  };

  const removeAlert = (id) => {
    setAlerts(alerts => alerts.filter(alert => alert.id !== id));
  };

  const fadeOutAlert = (id) => {
    const alertElement = document.getElementById(`alert-${id}`);
    if (alertElement) {
      alertElement.style.transition = 'opacity 0.5s ease-out';
      alertElement.style.opacity = '0';
      setTimeout(() => removeAlert(id), 500);
    } else {
      removeAlert(id);
    }
  };

  return (
    <AlertContext.Provider value={{ addAlert, removeAlert }}>
      {children}
      <div style={styles.alertContainer}>
        {alerts.map(alert => (
          <CAlert
            key={alert.id}
            id={`alert-${alert.id}`}
            color={alert.color}
            style={styles.alert}
            onClick={() => fadeOutAlert(alert.id)}
          >
            {alert.message}
          </CAlert>
        ))}
      </div>
    </AlertContext.Provider>
  );
};

const styles = {
  alertContainer: {
    position: 'fixed',
    bottom: 10,
    right: 10,
    zIndex: 1050,
    display: 'flex',
    flexDirection: 'column-reverse', // This will stack the alerts from bottom to top
    alignItems: 'flex-end',
  },
  alert: {
    cursor: 'pointer', // Makes the entire alert clickable
    marginBottom: '10px',
    width: '100%', // You can adjust the width as needed
    opacity: '1',
  },
};

export default AlertProviderWithDisplay;
