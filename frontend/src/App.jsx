import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { queryClient, QueryClientProvider } from './lib/queryClient';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { LeadsPage } from './pages/LeadsPage';
import { EngagementsPage } from './pages/EngagementsPage';

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="min-h-screen bg-background overflow-x-hidden">
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Navigate to="/leads" replace />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/leads"
                            element={
                                <ProtectedRoute>
                                    <LeadsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/engagements"
                            element={
                                <ProtectedRoute>
                                    <EngagementsPage />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </BrowserRouter>
                <Toaster />
            </div>
        </QueryClientProvider>
    );
}

export default App;
