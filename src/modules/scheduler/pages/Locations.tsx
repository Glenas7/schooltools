import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { useLocations } from '../contexts/LocationsContext';
import { useLessons } from '../contexts/LessonsContext';
import { useSchool } from '@/core/contexts';
import LocationList from '../components/locations/LocationList';
import LocationForm from '../components/locations/LocationForm';
import LocationQueue from '../components/locations/LocationQueue';
import BulkLocationAssignment from '../components/locations/BulkLocationAssignment';
import { Location, Lesson } from '../types';
import { Plus, MapPin, Clock, Users } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

const Locations = () => {
  const { locations, deleteLocation, getLessonsWithoutLocation, getAllLessons } = useLocations();
  const { currentSchool, isSchoolAdmin } = useSchool();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | undefined>(undefined);
  const [lessonsWithoutLocation, setLessonsWithoutLocation] = useState<Lesson[]>([]);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [activeTab, setActiveTab] = useState('locations');
  const [hidePastLessons, setHidePastLessons] = useState(false);
  const { toast } = useToast();

  // Helper function to filter out past lessons
  const filterPastLessons = (lessons: Lesson[]) => {
    if (!hidePastLessons) return lessons;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    return lessons.filter(lesson => {
      if (!lesson.end_date) return true; // Keep lessons with no end date
      
      const endDate = new Date(lesson.end_date);
      endDate.setHours(0, 0, 0, 0); // Start of the end date
      
      return endDate >= today; // Keep lessons that end today or later
    });
  };

  // Get filtered lessons for display
  const filteredLessonsWithoutLocation = filterPastLessons(lessonsWithoutLocation);
  const filteredAllLessons = filterPastLessons(allLessons);

  // Fetch lessons when tab changes or locations are updated
  useEffect(() => {
    const fetchLessons = async () => {
      if (currentSchool && (activeTab === 'queue' || activeTab === 'bulk')) {
        if (activeTab === 'queue') {
          const unlocatedLessons = await getLessonsWithoutLocation();
          setLessonsWithoutLocation(unlocatedLessons);
        } else if (activeTab === 'bulk') {
          const allLessonsData = await getAllLessons();
          setAllLessons(allLessonsData);
        }
      }
    };

    fetchLessons();
  }, [currentSchool, activeTab, getLessonsWithoutLocation, getAllLessons]);

  if (!currentSchool) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Locations
          </h1>
        </div>
        
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Please select a school to manage locations.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isSchoolAdmin) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Locations - {currentSchool.name}
          </h1>
        </div>
        
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Only school administrators can access location management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const handleAddLocation = () => {
    setEditingLocation(undefined);
    setIsFormOpen(true);
  };
  
  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setIsFormOpen(true);
  };
  
  const handleDeletePrompt = (id: string) => {
    setDeletingLocationId(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (deletingLocationId) {
      const location = locations.find(l => l.id === deletingLocationId);
      try {
        await deleteLocation(deletingLocationId);
        
        if (location) {
          toast({
            title: "Location deleted",
            description: `${location.name} has been deleted.`,
          });
        }
      } catch (error) {
        toast({
          title: "Error deleting location",
          description: "Failed to delete the location. Please try again.",
          variant: "destructive",
        });
      }
      
      setIsDeleteDialogOpen(false);
      setDeletingLocationId(null);
    }
  };

  const handleLocationAssigned = async () => {
    console.log('[Locations] handleLocationAssigned called, current tab:', activeTab);
    
    if (activeTab === 'queue') {
      // Refresh the lessons without location when a location is assigned
      const unlocatedLessons = await getLessonsWithoutLocation();
      console.log('[Locations] Fetched updated lessons without location:', {
        previousCount: lessonsWithoutLocation.length,
        newCount: unlocatedLessons.length,
        newLessons: unlocatedLessons.map(l => ({ id: l.id, student: l.student_name }))
      });
      setLessonsWithoutLocation(unlocatedLessons);
    } else if (activeTab === 'bulk') {
      // Refresh all lessons for bulk assignment
      const allLessonsData = await getAllLessons();
      console.log('[Locations] Fetched updated all lessons:', {
        previousCount: allLessons.length,
        newCount: allLessonsData.length
      });
      setAllLessons(allLessonsData);
    }
    
    toast({
      title: "Location assigned",
      description: "The location has been successfully assigned to the lesson(s).",
    });
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          Locations - {currentSchool.name}
        </h1>
        
        {(activeTab === 'queue' || activeTab === 'bulk') && (
          <div className="flex items-center space-x-2">
            <Switch
              id="hide-past-lessons"
              checked={hidePastLessons}
              onCheckedChange={setHidePastLessons}
            />
            <Label htmlFor="hide-past-lessons" className="text-sm font-medium">
              Hide past lessons
            </Label>
          </div>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Location Queue
            {filteredLessonsWithoutLocation.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-1">
                {filteredLessonsWithoutLocation.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Bulk Assignment
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="locations" className="flex-1 mt-6">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={handleAddLocation}>
                <Plus className="h-4 w-4 mr-1" />
                Add Location
              </Button>
            </div>
            
            <LocationList 
              locations={locations}
              onEditLocation={handleEditLocation}
              onDeleteLocation={handleDeletePrompt}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="queue" className="flex-1 mt-6">
          <LocationQueue 
            lessonsWithoutLocation={filteredLessonsWithoutLocation}
            onLocationAssigned={handleLocationAssigned}
          />
        </TabsContent>
        
        <TabsContent value="bulk" className="flex-1 mt-6">
          <BulkLocationAssignment 
            allLessons={filteredAllLessons}
            onLocationAssigned={handleLocationAssigned}
          />
        </TabsContent>
      </Tabs>
      
      <LocationForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        location={editingLocation}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the location
              and remove it from any assigned lessons.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Locations; 