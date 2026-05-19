import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { RefreshCw, Mail } from 'lucide-react';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithOtp({ email });

        if (error) {
            console.error('Login error:', error.message);
            setError(error.message);
            setLoading(false);
        } else {
            setSent(true);
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-sm shadow-lg border-border/50">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                            <Mail className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-xl">Kolla din inbox</CardTitle>
                        <CardDescription className="text-sm">
                            En inloggningslänk har skickats till <strong>{email}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <button
                            onClick={() => { setSent(false); setEmail(''); }}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Ändra emailadress
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm shadow-lg border-border/50">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl tracking-tight">Skyland Dashboard</CardTitle>
                    <CardDescription className="text-sm">
                        Logga in med din email
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="joakim@skylandai.se"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-11 sm:h-10"
                                autoComplete="email"
                            />
                        </div>
                        {error && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                {error}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="pt-2">
                        <Button
                            className="w-full h-11 sm:h-10 text-base sm:text-sm"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Skickar...
                                </>
                            ) : (
                                'Skicka inloggningslänk'
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};
