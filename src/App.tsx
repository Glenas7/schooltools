import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { SchoolProvider } from "./contexts/SchoolContext";
import { SchoolsProvider } from "./contexts/SchoolsContext";
import { SubjectsProvider } from "./contexts/SubjectsContext";
import { TeachersProvider } from "./contexts/TeachersContext";
import { LocationsProvider } from "./contexts/LocationsContext";
import LessonsProvider from "./contexts/LessonsContext";
import { DragProvider } from "./contexts/DragContext";

import MainLayout from "./components/layout/MainLayout";
import SchoolLayout from "./components/layout/SchoolLayout";
import RequireAuth from "./components/auth/RequireAuth";
import RequireSchoolAccess from "./components/auth/RequireSchoolAccess";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SchoolSetup from "./pages/SchoolSetup";
import SchoolSelect from "./pages/SchoolSelect";
import Schedule from "./pages/Schedule";
import Teachers from "./pages/Teachers";
import Subjects from "./pages/Subjects";
import Locations from "./pages/Locations";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SchoolsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
              {/* Public routes without school context */}
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Index />} />
                    <Route path="login" element={<Login />} />
                <Route path="signup" element={<Signup />} />
                    <Route path="forgot-password" element={<ForgotPassword />} />
                      <Route path="reset-password" element={<ResetPassword />} />
                
                {/* School management routes */}
                    <Route 
                  path="school-setup" 
                      element={
                        <RequireAuth>
                      <SchoolSetup />
                        </RequireAuth>
                      } 
                    />
                    <Route 
                  path="school-select" 
                      element={
                    <RequireAuth>
                      <SchoolSelect />
                        </RequireAuth>
                      } 
                    />
                  </Route>

              {/* School-specific routes with school context */}
              <Route path="/school/:schoolId" element={
                <RequireAuth>
                  <RequireSchoolAccess>
                    <SchoolProvider>
                      <SubjectsProvider>
                        <LocationsProvider>
                        <TeachersProvider>
                          <LessonsProvider>
                            <DragProvider>
                              <SchoolLayout />
              </DragProvider>
            </LessonsProvider>
          </TeachersProvider>
                        </LocationsProvider>
                      </SubjectsProvider>
                    </SchoolProvider>
                  </RequireSchoolAccess>
                </RequireAuth>
              }>
                <Route path="schedule" element={<Schedule />} />
                <Route path="teachers" element={<Teachers />} />
                <Route path="subjects" element={<Subjects />} />
                <Route path="locations" element={<Locations />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SchoolsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
