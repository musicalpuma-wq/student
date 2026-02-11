import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

export function GenericModal({ isOpen, type = 'alert', title, message, onConfirm, onCancel, inputPlaceholder, defaultValue = '' }) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
        setInputValue(defaultValue);
        if (type === 'prompt' && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
        }
    }
  }, [isOpen, type, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
      e.preventDefault();
      onConfirm(inputValue);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
      backdropFilter: 'blur(5px)'
    }} onClick={type === 'alert' ? onConfirm : onCancel}>
      <div className="card" style={{ width: '400px', maxWidth: '90vw', padding: '2rem' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
            {type === 'confirm' && <HelpCircle size={48} color="var(--color-accent)" style={{ marginBottom: '1rem' }} />}
            {type === 'alert' && <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: '1rem' }} />}
            {type === 'prompt' && <div style={{ marginBottom: '1rem', width: '48px', height: '4px', background: 'var(--color-accent)', borderRadius: '2px' }}></div>}
            
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>{title}</h3>
            {message && <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>{message}</p>}
        </div>

        {type === 'prompt' ? (
            <form onSubmit={handleSubmit}>
                <input 
                    ref={inputRef}
                    className="input-field"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={inputPlaceholder}
                    style={{ marginBottom: '1.5rem' }}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
                    <button type="submit" className="btn" style={{ flex: 1 }}>Confirm</button>
                </div>
            </form>
        ) : (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                {type === 'confirm' && (
                    <button 
                        className="btn btn-secondary" 
                        onClick={onCancel}
                        style={{ minWidth: '100px' }}
                    >
                        Cancel
                    </button>
                )}
                <button 
                    className="btn" 
                    onClick={() => onConfirm(inputValue)}
                    style={{ minWidth: '100px' }}
                >
                    {type === 'confirm' ? 'Confirm' : 'OK'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
