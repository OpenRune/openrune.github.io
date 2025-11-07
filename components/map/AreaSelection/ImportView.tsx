"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollectionControl } from '@/lib/map/controls/CollectionControl';
import { ImportFormat, ImportType } from './types';
import { detectFormat } from './utils';
import { parseAndImport117HD, parseAndImportNormal } from './importParsers';
import { toast } from 'sonner';

interface ImportViewProps {
    importFormat: ImportFormat;
    collectionControl: CollectionControl | null | undefined;
    onBack: () => void;
    onImportModeChange?: (isImportMode: boolean) => void;
}

export function ImportView({
    importFormat,
    collectionControl,
    onBack,
    onImportModeChange
}: ImportViewProps) {
    const [importText, setImportText] = useState('');
    const [importType, setImportType] = useState<ImportType>('auto');

    const handleImportFromGit = async () => {
        try {
            const url = 'https://raw.githubusercontent.com/117HD/RLHD/refs/heads/master/src/main/resources/rs117/hd/scene/areas.json';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch from GitHub');
            }
            const text = await response.text();
            setImportText(text);
            
            if (collectionControl) {
                parseAndImport117HD(text, collectionControl, onImportModeChange);
            }
        } catch (error) {
            toast.error('Failed to fetch from GitHub');
        }
    };

    const handleImportSubmit = () => {
        if (!importText.trim()) {
            toast.error('Please enter data to import');
            return;
        }

        if (importFormat === '117hd') {
            if (collectionControl) {
                parseAndImport117HD(importText, collectionControl, onImportModeChange);
            }
        } else {
            const detected = detectFormat(importText);
            const type = importType === 'auto' ? detected.type : importType;
            const { format } = detected;
            
            if (collectionControl) {
                parseAndImportNormal(importText, format, type, collectionControl, onImportModeChange);
            }
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
                {importFormat === 'normal' && (
                    <div className="space-y-2">
                        <Label htmlFor="import-type">Type</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setImportType('auto')}
                                className={cn(
                                    "flex-1 relative",
                                    importType === 'auto' && "bg-gray-700 border-gray-600 shadow-inner"
                                )}
                            >
                                {importType === 'auto' && (
                                    <div className="absolute inset-0 bg-green-500/30 rounded-md pointer-events-none" />
                                )}
                                <span className={cn(
                                    "relative z-10",
                                    importType === 'auto' ? "opacity-100" : "opacity-70"
                                )}>Auto Detect</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setImportType('area')}
                                className={cn(
                                    "flex-1 relative",
                                    importType === 'area' && "bg-gray-700 border-gray-600 shadow-inner"
                                )}
                            >
                                {importType === 'area' && (
                                    <div className="absolute inset-0 bg-green-500/30 rounded-md pointer-events-none" />
                                )}
                                <span className={cn(
                                    "relative z-10",
                                    importType === 'area' ? "opacity-100" : "opacity-70"
                                )}>Area</span>
                            </Button>
                        </div>
                    </div>
                )}

                {importFormat === '117hd' && (
                    <div className="space-y-2">
                        <Label>Import from Git</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleImportFromGit}
                            className="w-full"
                        >
                            Import from Git
                        </Button>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="import-text">Paste your data here</Label>
                    <textarea
                        id="import-text"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder={importFormat === '117hd' 
                            ? 'Paste 117HD JSON format here...'
                            : 'Paste JSON, Java, Array, or Raw format here...'
                        }
                        className="min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onBack}
                        className="flex-1"
                    >
                        <ArrowLeft className="h-3 w-3 mr-2" />
                        Back
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleImportSubmit}
                        className="flex-1"
                    >
                        Import
                    </Button>
                </div>
            </div>
        </div>
    );
}

