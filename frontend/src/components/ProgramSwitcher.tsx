/**
 * Program switcher component - shows current program and allows switching for multi-program users
 */
import React, { useState } from 'react';
import { useProgram } from '../contexts/ProgramContext';

export function ProgramSwitcher() {
  const { currentProgram, programs, setCurrentProgram } = useProgram();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show if no program selected or only one program
  if (!currentProgram || programs.length <= 1) {
    return null;
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          border: '1px solid #e0e0e0',
          borderRadius: '6px',
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontWeight: '500' }}>{currentProgram.name}</span>
        <span style={{ fontSize: '12px', color: '#666' }}>▼</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
          />

          {/* Dropdown menu */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              minWidth: '200px',
              zIndex: 1000,
            }}
          >
            <div style={{ padding: '8px 0' }}>
              {programs.map((program) => (
                <button
                  key={program.id}
                  onClick={() => {
                    setCurrentProgram(program);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    backgroundColor: program.id === currentProgram.id ? '#f0f8ff' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: program.id === currentProgram.id ? '600' : '400',
                    color: program.id === currentProgram.id ? '#2196F3' : '#333',
                  }}
                  onMouseEnter={(e) => {
                    if (program.id !== currentProgram.id) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (program.id !== currentProgram.id) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  {program.name}
                  {program.id === currentProgram.id && (
                    <span style={{ marginLeft: '8px', color: '#2196F3' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
