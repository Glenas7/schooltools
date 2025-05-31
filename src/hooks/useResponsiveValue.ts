import { useState, useEffect } from 'react';

type ResponsiveOptions<T> = {
  mobile: T;
  tablet: T;
  desktop: T;
};

const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

export function useResponsiveValue<T>(options: ResponsiveOptions<T>): T {
  const [value, setValue] = useState<T>(options.desktop);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.tablet) {
        setValue(options.mobile);
      } else if (width < BREAKPOINTS.desktop) {
        setValue(options.tablet);
      } else {
        setValue(options.desktop);
      }
    };

    // Initialize
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, [options]);

  return value;
}

export default useResponsiveValue; 