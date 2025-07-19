export const navigateToModule = async (
  moduleName: string, 
  schoolSlug: string, 
  path: string = '',
  supabaseClient?: any
) => {
  const moduleSubdomains = {
    scheduler: process.env.NODE_ENV === 'development' 
      ? 'localhost:3001' 
      : 'scheduler.schooltools.online',
    'lunch-menu': process.env.NODE_ENV === 'development'
      ? 'localhost:3002'
      : 'lunch-menu.schooltools.online'
  };
  
  const subdomain = moduleSubdomains[moduleName as keyof typeof moduleSubdomains];
  if (!subdomain) {
    console.error(`Unknown module: ${moduleName}`);
    return;
  }
  
  const protocol = process.env.NODE_ENV === 'development' ? 'http://' : 'https://';
  let targetUrl = `${protocol}${subdomain}/school/${schoolSlug}${path}`;
  
  // In development, pass session tokens for cross-origin authentication
  if (process.env.NODE_ENV === 'development' && supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        const authParams = new URLSearchParams();
        authParams.set('access_token', session.access_token);
        authParams.set('refresh_token', session.refresh_token);
        authParams.set('from_hub', 'true');
        targetUrl += `?${authParams.toString()}`;
      }
    } catch (error) {
      console.error('Error getting session for module navigation:', error);
    }
  }
  
  console.log(`Navigating to module: ${moduleName} at ${targetUrl}`);
  window.location.href = targetUrl;
};

export const navigateToCentralHub = (path: string = '') => {
  const centralHubUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8081'
    : 'https://app.schooltools.online';
    
  // Add a parameter to indicate this is an explicit navigation back
  const separator = path.includes('?') ? '&' : '?';
  const targetUrl = `${centralHubUrl}${path}${separator}return=true`;
  
  console.log(`Navigating to central hub: ${targetUrl}`);
  window.location.href = targetUrl;
};

export const getCurrentSubdomain = (): string => {
  if (process.env.NODE_ENV === 'development') {
    const port = window.location.port;
    switch (port) {
      case '8081': return 'app';
      case '3001': return 'scheduler';
      case '3002': return 'lunch-menu';
      default: return 'app';
    }
  }
  
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  if (parts.length >= 3) {
    return parts[0]; // First part is the subdomain
  }
  
  return 'app'; // Default to app subdomain
};

export const getModuleDisplayName = (moduleName: string): string => {
  const moduleDisplayNames = {
    scheduler: 'Lesson Scheduler',
    'lunch-menu': 'Lunch Menu',
  };
  
  return moduleDisplayNames[moduleName as keyof typeof moduleDisplayNames] || moduleName;
}; 