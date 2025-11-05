'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IconHome, IconArrowLeft, IconAlertCircle } from '@tabler/icons-react';

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="flex min-h-screen items-center justify-center p-8">
            <Card className="max-w-lg w-full border-2">
                <CardContent className="pt-12 pb-8 px-8 text-center space-y-6">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative">
                            <IconAlertCircle className="h-24 w-24 text-muted-foreground/20" strokeWidth={1.5} />
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl font-extrabold text-foreground/10 select-none">
                                404
                            </span>
                        </div>
                        
                        <div className="space-y-2">
                            <h1 className="text-4xl font-bold tracking-tight">
                                Page Not Found
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                The page you&apos;re looking for doesn&apos;t exist or has been moved.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                        <Button 
                            onClick={() => router.back()} 
                            variant="outline" 
                            size="lg"
                            className="gap-2"
                        >
                            <IconArrowLeft className="h-4 w-4" />
                            Go Back
                        </Button>
                        <Button
                            onClick={() => router.push('/')}
                            variant="default"
                            size="lg"
                            className="gap-2"
                        >
                            <IconHome className="h-4 w-4" />
                            Back to Home
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}