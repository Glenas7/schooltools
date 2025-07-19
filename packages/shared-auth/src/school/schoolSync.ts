import { School } from '../types';
import { CrossDomainStorage } from '../storage/crossDomainStorage';

export const syncSchoolAcrossApps = (school: School | null) => {
  console.log('Syncing school across apps:', school?.name || 'null');
  
  if (school) {
    CrossDomainStorage.setSharedData({
      currentSchool: school,
      type: 'school_sync'
    });
  } else {
    CrossDomainStorage.clearSharedData();
  }
};

export const getCurrentSchoolFromSync = (): School | null => {
  const data = CrossDomainStorage.getSharedData();
  
  if (!data || data.type !== 'school_sync') {
    console.log('No synced school data found or invalid type');
    return null;
  }
  
  console.log('Retrieved synced school:', data.currentSchool?.name);
  return data.currentSchool || null;
};

export const clearSchoolSync = () => {
  console.log('Clearing school sync data');
  CrossDomainStorage.clearSharedData();
}; 