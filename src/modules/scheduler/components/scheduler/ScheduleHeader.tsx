import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScheduleHeaderProps {
  weekDates: Date[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  showTitle?: boolean;
}

const ScheduleHeader = ({ 
  weekDates, 
  onPrevWeek, 
  onNextWeek, 
  onCurrentWeek,
  showTitle = true
}: ScheduleHeaderProps) => {
  const startDate = weekDates[0];
  const endDate = weekDates[weekDates.length - 1];
  
  return (
    <div className="flex justify-between items-center mb-6">
      {showTitle && (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Weekly Schedule</h1>
        <p className="text-gray-500">
          {format(startDate, 'MMMM d')} - {format(endDate, 'MMMM d, yyyy')}
        </p>
      </div>
      )}
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous Week
        </Button>
        <Button variant="outline" size="sm" onClick={onCurrentWeek}>
          Current Week
        </Button>
        <Button variant="outline" size="sm" onClick={onNextWeek}>
          Next Week
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default ScheduleHeader;
