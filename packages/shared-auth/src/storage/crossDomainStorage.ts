export class CrossDomainStorage {
  private static readonly STORAGE_KEY = 'schooltools_shared_state';
  private static readonly AUTH_REDIRECT_KEY = 'auth_redirect_after_login';
  
  static setSharedData(data: any) {
    const serializedData = JSON.stringify({
      ...data,
      timestamp: Date.now()
    });
    
    try {
      localStorage.setItem(this.STORAGE_KEY, serializedData);
      // Also set in sessionStorage for cross-tab communication
      sessionStorage.setItem(this.STORAGE_KEY, serializedData);
    } catch (error) {
      console.error('Failed to store shared data:', error);
    }
  }
  
  static getSharedData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY) || 
                   sessionStorage.getItem(this.STORAGE_KEY);
      
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      
      // Check if data is expired (30 minutes)
      if (Date.now() - parsed.timestamp > 30 * 60 * 1000) {
        this.clearSharedData();
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to get shared data:', error);
      return null;
    }
  }
  
  static clearSharedData() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      sessionStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear shared data:', error);
    }
  }
  
  static setAuthRedirect(url: string) {
    try {
      localStorage.setItem(this.AUTH_REDIRECT_KEY, url);
    } catch (error) {
      console.error('Failed to set auth redirect:', error);
    }
  }
  
  static getAuthRedirect(): string | null {
    try {
      return localStorage.getItem(this.AUTH_REDIRECT_KEY);
    } catch (error) {
      console.error('Failed to get auth redirect:', error);
      return null;
    }
  }
  
  static clearAuthRedirect() {
    try {
      localStorage.removeItem(this.AUTH_REDIRECT_KEY);
    } catch (error) {
      console.error('Failed to clear auth redirect:', error);
    }
  }
} 