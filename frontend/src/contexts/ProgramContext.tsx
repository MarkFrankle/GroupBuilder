/**
 * Program context provider for managing user's program selection
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { authenticatedFetch } from '../utils/apiClient';

interface Program {
  id: string;
  name: string;
  created_at?: any;
}

interface ProgramContextType {
  currentProgram: Program | null;
  programs: Program[];
  loading: boolean;
  needsProgramSelection: boolean;
  setCurrentProgram: (program: Program) => void;
  refreshPrograms: () => Promise<void>;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

const PROGRAM_STORAGE_KEY = 'groupbuilder_current_program';

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentProgram, setCurrentProgramState] = useState<Program | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsProgramSelection, setNeedsProgramSelection] = useState(false);

  // Fetch user's programs from backend
  const fetchPrograms = async () => {
    if (!user) {
      setPrograms([]);
      setCurrentProgramState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/user/me/programs');
      const data = await response.json();

      setPrograms(data.programs || []);

      // Auto-select program
      if (data.programs.length === 0) {
        // No programs - user needs to be invited
        setCurrentProgramState(null);
        setNeedsProgramSelection(false);
      } else if (data.programs.length === 1) {
        // Single program - auto-select
        const program = data.programs[0];
        setCurrentProgramState(program);
        setNeedsProgramSelection(false);
        localStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(program));
      } else {
        // Multiple programs - check if user has a stored preference
        const storedProgramStr = localStorage.getItem(PROGRAM_STORAGE_KEY);
        if (storedProgramStr) {
          try {
            const storedProgram = JSON.parse(storedProgramStr);
            // Verify stored program is still valid
            const stillValid = data.programs.some((program: Program) => program.id === storedProgram.id);
            if (stillValid) {
              setCurrentProgramState(storedProgram);
              setNeedsProgramSelection(false);
            } else {
              // Stored program is no longer valid
              setNeedsProgramSelection(true);
              setCurrentProgramState(null);
            }
          } catch (e) {
            // Invalid stored data
            setNeedsProgramSelection(true);
            setCurrentProgramState(null);
          }
        } else {
          // No stored preference - need selection
          setNeedsProgramSelection(true);
          setCurrentProgramState(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch programs:', error);
      setPrograms([]);
      setCurrentProgramState(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch programs when user logs in
  useEffect(() => {
    fetchPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Clear program data when user logs out
  useEffect(() => {
    if (!user) {
      setPrograms([]);
      setCurrentProgramState(null);
      setNeedsProgramSelection(false);
      localStorage.removeItem(PROGRAM_STORAGE_KEY);
    }
  }, [user]);

  const setCurrentProgram = (program: Program) => {
    setCurrentProgramState(program);
    setNeedsProgramSelection(false);
    localStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(program));
  };

  const refreshPrograms = async () => {
    await fetchPrograms();
  };

  return (
    <ProgramContext.Provider
      value={{
        currentProgram,
        programs,
        loading,
        needsProgramSelection,
        setCurrentProgram,
        refreshPrograms
      }}
    >
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  const context = useContext(ProgramContext);
  if (context === undefined) {
    throw new Error('useProgram must be used within ProgramProvider');
  }
  return context;
}
