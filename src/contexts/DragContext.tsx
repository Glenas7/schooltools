import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of our dragged lesson data
interface DraggedLesson {
  id: string;
  duration: number;
}

// Define the context shape
interface DragContextType {
  draggedLesson: DraggedLesson | null;
  setDraggedLesson: (lesson: DraggedLesson | null) => void;
}

// Create the context with default values
const DragContext = createContext<DragContextType>({
  draggedLesson: null,
  setDraggedLesson: () => {},
});

// Create a provider component
export const DragProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [draggedLesson, setDraggedLesson] = useState<DraggedLesson | null>(null);

  return (
    <DragContext.Provider value={{ draggedLesson, setDraggedLesson }}>
      {children}
    </DragContext.Provider>
  );
};

// Create a custom hook for using this context
export const useDrag = () => useContext(DragContext); 
 
 
 