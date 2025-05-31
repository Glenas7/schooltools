import { useContext } from 'react';
import { TeachersContext, TeachersContextType } from '../contexts/TeachersContext'; // Assuming TeachersContextType is exported

export const useTeachers = (): TeachersContextType => {
  const context = useContext(TeachersContext);
  if (context === undefined) {
    throw new Error('useTeachers must be used within a TeachersProvider');
  }
  return context;
}; 
 
 
 