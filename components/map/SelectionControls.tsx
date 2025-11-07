"use client";

import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectionControlsProps {
    visible: boolean;
    type: 'area' | 'poly' | null;
}

export function SelectionControls({ visible, type }: SelectionControlsProps) {
    if (!visible || !type) return null;

    return (
        <Card className="absolute bottom-4 left-4 z-[1000] bg-black/90 border-border">
            <CardContent className="p-3">
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-white mb-2">
                        Move Selection
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Move className="h-3 w-3" />
                            <span>Click & drag to move</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <ArrowUp className="h-3 w-3" />
                                <ArrowDown className="h-3 w-3" />
                                <ArrowLeft className="h-3 w-3" />
                                <ArrowRight className="h-3 w-3" />
                            </div>
                            <span>Arrow keys to move tile by tile</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

