import { createContext, useContext, useState, useCallback } from 'react';
import { GenericModal } from '../components/GenericModal';

const GlobalModalContext = createContext();

export function useGlobalModal() {
  const context = useContext(GlobalModalContext);
  if (!context) {
    throw new Error('useGlobalModal must be used within a GlobalModalProvider');
  }
  return context;
}

export function GlobalModalProvider({ children }) {
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    inputPlaceholder: '',
    defaultValue: ''
  });

  const closeModal = useCallback(() => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  const showAlert = useCallback((title, message, onConfirm) => {
    setModalConfig({
      isOpen: true,
      type: 'alert',
      title,
      message,
      onConfirm: () => {
        if (onConfirm) onConfirm();
        closeModal();
      },
      onCancel: closeModal
    });
  }, [closeModal]);

  const showConfirm = useCallback((title, message, onConfirm, onCancel) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm: (val) => {
        if (onConfirm) onConfirm(val);
        closeModal();
      },
      onCancel: () => {
        if (onCancel) onCancel();
        closeModal();
      }
    });
  }, [closeModal]);

  const showPrompt = useCallback((title, message, onConfirm, onCancel, inputPlaceholder = '', defaultValue = '') => {
    setModalConfig({
      isOpen: true,
      type: 'prompt',
      title,
      message,
      inputPlaceholder,
      defaultValue,
      onConfirm: (val) => {
        if (onConfirm) onConfirm(val);
        closeModal();
      },
      onCancel: () => {
        if (onCancel) onCancel();
        closeModal();
      }
    });
  }, [closeModal]);

  return (
    <GlobalModalContext.Provider value={{ showAlert, showConfirm, showPrompt, closeModal }}>
      {children}
      <GenericModal 
        {...modalConfig} 
        onCancel={modalConfig.onCancel || closeModal}
      />
    </GlobalModalContext.Provider>
  );
}
