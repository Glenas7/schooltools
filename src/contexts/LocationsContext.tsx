import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Location, LessonLocation, Lesson } from '../types';
import { useSchool } from './SchoolContext';

interface LocationsContextType {
  locations: Location[];
  fetchLocations: () => Promise<void>;
  createLocation: (locationData: Omit<Location, 'id' | 'school_id' | 'created_at' | 'updated_at'>) => Promise<Location | null>;
  updateLocation: (locationData: Partial<Location> & { id: string }) => Promise<Location | null>;
  deleteLocation: (locationId: string) => Promise<void>;
  assignLocationToLesson: (lessonId: string, locationId: string) => Promise<void>;
  removeLocationFromLesson: (lessonId: string) => Promise<void>;
  getLessonLocation: (lessonId: string) => Promise<Location | null>;
  getLessonsWithoutLocation: () => Promise<Lesson[]>;
  getAllLessons: () => Promise<Lesson[]>;
  assignLocationToMultipleLessons: (lessonIds: string[], locationId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

const LocationsContext = createContext<LocationsContextType | undefined>(undefined);

const LocationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { currentSchool, isSchoolAdmin } = useSchool();

  const fetchLocations = useCallback(async () => {
    if (!currentSchool) {
      setLocations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('locations')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('name');

      if (fetchError) throw fetchError;

      setLocations(data || []);
    } catch (e) {
      setError(e as Error);
      console.error('Error fetching locations:', e);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [currentSchool]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const createLocation = async (locationData: Omit<Location, 'id' | 'school_id' | 'created_at' | 'updated_at'>): Promise<Location | null> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error("Admin access required"));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: createError } = await supabase
        .from('locations')
        .insert({
          ...locationData,
          school_id: currentSchool.id
        })
        .select()
        .single();

      if (createError) throw createError;

      const newLocation = data as Location;
      setLocations(prev => [...prev, newLocation]);
      setLoading(false);
      return newLocation;
    } catch (e) {
      setError(e as Error);
      console.error('Error creating location:', e);
      setLoading(false);
      return null;
    }
  };

  const updateLocation = async (locationData: Partial<Location> & { id: string }): Promise<Location | null> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error("Admin access required"));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from('locations')
        .update({
          name: locationData.name
        })
        .eq('id', locationData.id)
        .eq('school_id', currentSchool.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedLocation = data as Location;
      setLocations(prev => prev.map(location => 
        location.id === locationData.id ? updatedLocation : location
      ));
      setLoading(false);
      return updatedLocation;
    } catch (e) {
      setError(e as Error);
      console.error('Error updating location:', e);
      setLoading(false);
      return null;
    }
  };

  const deleteLocation = async (locationId: string): Promise<void> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error("Admin access required"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId)
        .eq('school_id', currentSchool.id);

      if (deleteError) throw deleteError;

      setLocations(prev => prev.filter(location => location.id !== locationId));
      setLoading(false);
    } catch (e) {
      setError(e as Error);
      console.error('Error deleting location:', e);
      setLoading(false);
    }
  };

  const assignLocationToLesson = async (lessonId: string, locationId: string): Promise<void> => {
    if (!currentSchool) {
      setError(new Error("School context required"));
      return;
    }

    console.log('[LocationsContext] assignLocationToLesson called:', { lessonId, locationId });
    setLoading(true);
    setError(null);

    try {
      // First, check if lesson already has a location and remove it
      console.log('[LocationsContext] Deleting existing location assignments for lesson:', lessonId);
      const { error: deleteError } = await supabase
        .from('lesson_locations')
        .delete()
        .eq('lesson_id', lessonId);

      if (deleteError) throw deleteError;

      // Then assign the new location
      console.log('[LocationsContext] Inserting new location assignment:', { lessonId, locationId });
      const { error: insertError } = await supabase
        .from('lesson_locations')
        .insert({
          lesson_id: lessonId,
          location_id: locationId
        });

      if (insertError) throw insertError;

      console.log('[LocationsContext] Location assignment completed successfully');
      setLoading(false);
    } catch (e) {
      setError(e as Error);
      console.error('Error assigning location to lesson:', e);
      setLoading(false);
    }
  };

  const removeLocationFromLesson = async (lessonId: string): Promise<void> => {
    if (!currentSchool) {
      setError(new Error("School context required"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('lesson_locations')
        .delete()
        .eq('lesson_id', lessonId);

      if (deleteError) throw deleteError;

      setLoading(false);
    } catch (e) {
      setError(e as Error);
      console.error('Error removing location from lesson:', e);
      setLoading(false);
    }
  };

  const getLessonLocation = async (lessonId: string): Promise<Location | null> => {
    if (!currentSchool) {
      return null;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('lesson_locations')
        .select(`
          location_id,
          locations (
            id,
            school_id,
            name,
            created_at,
            updated_at
          )
        `)
        .eq('lesson_id', lessonId)
        .single();

      if (fetchError || !data || !data.locations) {
        return null;
      }

      return data.locations as unknown as Location;
    } catch (e) {
      console.error('Error fetching lesson location:', e);
      return null;
    }
  };

  const getLessonsWithoutLocation = async (): Promise<Lesson[]> => {
    if (!currentSchool) {
      console.log('[LocationsContext] getLessonsWithoutLocation: No current school');
      return [];
    }

    console.log('[LocationsContext] getLessonsWithoutLocation: Fetching lessons for school:', currentSchool.id);

    try {
      // First, get all lesson IDs that have locations
      const { data: lessonsWithLocations, error: locationsError } = await supabase
        .from('lesson_locations')
        .select('lesson_id');

      if (locationsError) throw locationsError;

      const lessonIdsWithLocations = lessonsWithLocations?.map(ll => ll.lesson_id) || [];
      console.log('[LocationsContext] Lesson IDs with locations:', lessonIdsWithLocations);

      // Then get all lessons for this school that are NOT in that list
      let query = supabase
        .from('lessons')
        .select('*')
        .eq('school_id', currentSchool.id);

      if (lessonIdsWithLocations.length > 0) {
        query = query.not('id', 'in', `(${lessonIdsWithLocations.join(',')})`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      console.log('[LocationsContext] getLessonsWithoutLocation: Raw data from DB:', {
        count: data?.length || 0,
        firstFew: data?.slice(0, 3).map(l => ({ 
          id: l.id, 
          student: l.student_name, 
          duration_minutes: l.duration_minutes,
          lesson_locations: l.lesson_locations 
        }))
      });

      // Map database fields to frontend format
      const mappedLessons = data?.map(lesson => ({
        id: lesson.id,
        school_id: lesson.school_id,
        student_name: lesson.student_name,
        duration: lesson.duration_minutes,
        teacher_id: lesson.teacher_id,
        day: lesson.day_of_week,
        start_time: lesson.start_time,
        subject_id: lesson.subject_id,
        start_date: lesson.start_date,
        end_date: lesson.end_date,
        created_at: lesson.created_at,
        updated_at: lesson.updated_at
      })) || [];

      console.log('[LocationsContext] getLessonsWithoutLocation: Mapped lessons:', {
        count: mappedLessons.length,
        firstFew: mappedLessons.slice(0, 3).map(l => ({ id: l.id, student: l.student_name, duration: l.duration }))
      });

      return mappedLessons;
    } catch (e) {
      console.error('Error fetching lessons without location:', e);
      return [];
    }
  };

  const getAllLessons = async (): Promise<Lesson[]> => {
    if (!currentSchool) {
      console.log('[LocationsContext] getAllLessons: No current school');
      return [];
    }

    console.log('[LocationsContext] getAllLessons: Fetching all lessons for school:', currentSchool.id);

    try {
      const { data, error: fetchError } = await supabase
        .from('lessons')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('student_name', { ascending: true });

      if (fetchError) throw fetchError;

      console.log('[LocationsContext] getAllLessons: Raw data from DB:', {
        count: data?.length || 0,
        firstFew: data?.slice(0, 3).map(l => ({ 
          id: l.id, 
          student: l.student_name, 
          duration_minutes: l.duration_minutes
        }))
      });

      // Map database fields to frontend format
      const mappedLessons = data?.map(lesson => ({
        id: lesson.id,
        school_id: lesson.school_id,
        student_name: lesson.student_name,
        duration: lesson.duration_minutes,
        teacher_id: lesson.teacher_id,
        day: lesson.day_of_week,
        start_time: lesson.start_time,
        subject_id: lesson.subject_id,
        start_date: lesson.start_date,
        end_date: lesson.end_date,
        created_at: lesson.created_at,
        updated_at: lesson.updated_at
      })) || [];

      console.log('[LocationsContext] getAllLessons: Mapped lessons:', {
        count: mappedLessons.length,
        firstFew: mappedLessons.slice(0, 3).map(l => ({ id: l.id, student: l.student_name, duration: l.duration }))
      });

      return mappedLessons;
    } catch (e) {
      console.error('Error fetching all lessons:', e);
      return [];
    }
  };

  const assignLocationToMultipleLessons = async (lessonIds: string[], locationId: string): Promise<void> => {
    if (!currentSchool) {
      setError(new Error("School context required"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Remove existing locations for these lessons
      const { error: deleteError } = await supabase
        .from('lesson_locations')
        .delete()
        .in('lesson_id', lessonIds);

      if (deleteError) throw deleteError;

      // Insert new location assignments
      const lessonLocationData = lessonIds.map(lessonId => ({
        lesson_id: lessonId,
        location_id: locationId
      }));

      const { error: insertError } = await supabase
        .from('lesson_locations')
        .insert(lessonLocationData);

      if (insertError) throw insertError;

      setLoading(false);
    } catch (e) {
      setError(e as Error);
      console.error('Error assigning location to multiple lessons:', e);
      setLoading(false);
    }
  };

  return (
    <LocationsContext.Provider value={{
      locations,
      fetchLocations,
      createLocation,
      updateLocation,
      deleteLocation,
      assignLocationToLesson,
      removeLocationFromLesson,
      getLessonLocation,
      getLessonsWithoutLocation,
      getAllLessons,
      assignLocationToMultipleLessons,
      loading,
      error
    }}>
      {children}
    </LocationsContext.Provider>
  );
};

export { LocationsProvider, LocationsContext };

export const useLocations = () => {
  const context = useContext(LocationsContext);
  if (context === undefined) {
    throw new Error('useLocations must be used within a LocationsProvider');
  }
  return context;
}; 