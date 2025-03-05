import React, { createContext, useContext, useState } from 'react';

const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
  const [modelId, setModelId] = useState(null);
  const [visible, setVisible] = useState(false);

  const openModal = (id) => {
    setModelId(id);
    setVisible(true);
  };

  const closeModal = () => {
    setVisible(false);
    setModelId(null);
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal, visible, modelId }}>
      {children}
    </ModalContext.Provider>
  );
};

// Hook to use modal context
export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
