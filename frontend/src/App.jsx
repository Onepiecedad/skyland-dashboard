import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { queryClient, QueryClientProvider } from './lib/queryClient';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { LeadsPage } from './pages/LeadsPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';

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
                            path="/customers"
                            element={
                                <ProtectedRoute>
                                    <CustomersPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/customers/:id"
                            element={
                                <ProtectedRoute>
                                    <CustomerDetailPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Bakåtkompatibilitet — engagements → customers */}
                        <Route
                            path="/engagements"
                            element={
                                <ProtectedRoute>
                                    <Navigate to="/customers" replace />
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
