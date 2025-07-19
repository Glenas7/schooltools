import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Trash, InfoIcon, MapPin } from 'lucide-react';
import { Location } from '../../types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocations } from '../../contexts/LocationsContext';
import { useSchool } from '../../contexts/SchoolContextWrapper';

interface LocationListProps {
  locations: Location[];
  onEditLocation: (location: Location) => void;
  onDeleteLocation: (id: string) => void;
}

const LocationList = ({ locations, onEditLocation, onDeleteLocation }: LocationListProps) => {
  const { loading, error } = useLocations();
  const { isSchoolAdmin, currentSchool } = useSchool();

  if (!currentSchool) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Location List</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Please select a school to view locations.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Location List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading locations...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Location List</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Error loading locations: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location List ({locations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              No locations have been created for {currentSchool.name} yet. 
              {isSchoolAdmin && " Click the 'Add Location' button to create your first location."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {locations.map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{location.name}</span>
                </div>
                {isSchoolAdmin && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditLocation(location)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteLocation(location.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationList; 