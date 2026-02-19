/**
 * Program selector page for users who belong to multiple programs
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProgram } from '../contexts/ProgramContext';

export default function ProgramSelectorPage() {
  const navigate = useNavigate();
  const { programs, setCurrentProgram } = useProgram();

  const handleSelectProgram = (program: any) => {
    setCurrentProgram(program);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-10 max-w-lg w-full">
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Select Your Program
        </h1>
        <p className="text-gray-500 text-center mb-8">
          You're a facilitator for multiple cohorts. Which one are you working on?
        </p>

        <div className="flex flex-col gap-3">
          {programs.map((program) => (
            <button
              key={program.id}
              onClick={() => handleSelectProgram(program)}
              className="p-4 border-2 border-gray-200 rounded-lg bg-white text-left text-base font-medium transition-all hover:border-blue-500 hover:bg-blue-50"
            >
              {program.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
