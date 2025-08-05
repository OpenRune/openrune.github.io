'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconFile, IconX, IconChevronDown, IconUpload } from '@tabler/icons-react';
import { UploadedFile } from '@/lib/types/performance';
import { formatFileSize } from '@/lib/utils/performance';

interface FileDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  uploadedFiles: UploadedFile[];
  dropdownMode: 'single' | 'compare';
  onDropdownModeChange: (mode: 'single' | 'compare') => void;
  onSingleFileUpload: (event: React.ChangeEvent<HTMLInputElement>, fileIndex: number) => void;
  onRemoveFile: (index: number) => void;
  dropdownFileInputRef1: React.RefObject<HTMLInputElement>;
  dropdownFileInputRef2: React.RefObject<HTMLInputElement>;
}

export default function FileDropdown({
  isOpen,
  onToggle,
  uploadedFiles,
  dropdownMode,
  onDropdownModeChange,
  onSingleFileUpload,
  onRemoveFile,
  dropdownFileInputRef1,
  dropdownFileInputRef2
}: FileDropdownProps) {
  return (
    <div className="relative file-dropdown">
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={onToggle}
      >
        <IconFile size={16} />
        Files
        <IconChevronDown size={16} />
      </Button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-96 bg-popover border rounded-lg shadow-lg z-50">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Uploaded Files</h3>
            </div>
            
            <Tabs value={dropdownMode} onValueChange={(value) => onDropdownModeChange(value as 'single' | 'compare')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="single" className="text-xs">Single</TabsTrigger>
                <TabsTrigger value="compare" className="text-xs">Compare</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-3 mt-3">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
                  <input
                    ref={dropdownFileInputRef1}
                    type="file"
                    accept=".json"
                    onChange={(e) => onSingleFileUpload(e, 0)}
                    className="hidden"
                  />
                  <Button
                    onClick={() => dropdownFileInputRef1.current?.click()}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 mx-auto text-xs"
                    disabled={uploadedFiles[0] !== undefined}
                  >
                    <IconUpload size={12} />
                    Select File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Single file analysis
                  </p>
                  {uploadedFiles[0] && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{uploadedFiles[0].name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveFile(0)}
                          className="text-red-500 hover:text-red-700 h-5 w-5 p-0"
                        >
                          <IconX size={10} />
                        </Button>
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">{formatFileSize(uploadedFiles[0].size)}</Badge>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="compare" className="space-y-3 mt-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
                    <input
                      ref={dropdownFileInputRef1}
                      type="file"
                      accept=".json"
                      onChange={(e) => onSingleFileUpload(e, 0)}
                      className="hidden"
                    />
                    <Button
                      onClick={() => dropdownFileInputRef1.current?.click()}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 mx-auto text-xs"
                      disabled={uploadedFiles[0] !== undefined}
                    >
                      <IconUpload size={12} />
                      First File
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      First to compare
                    </p>
                    {uploadedFiles[0] && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{uploadedFiles[0].name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveFile(0)}
                            className="text-red-500 hover:text-red-700 h-5 w-5 p-0"
                          >
                            <IconX size={10} />
                          </Button>
                        </div>
                        <Badge variant="secondary" className="text-xs mt-1">{formatFileSize(uploadedFiles[0].size)}</Badge>
                      </div>
                    )}
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
                    <input
                      ref={dropdownFileInputRef2}
                      type="file"
                      accept=".json"
                      onChange={(e) => onSingleFileUpload(e, 1)}
                      className="hidden"
                    />
                    <Button
                      onClick={() => dropdownFileInputRef2.current?.click()}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 mx-auto text-xs"
                      disabled={uploadedFiles[1] !== undefined}
                    >
                      <IconUpload size={12} />
                      Second File
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Second to compare
                    </p>
                    {uploadedFiles[1] && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{uploadedFiles[1].name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveFile(1)}
                            className="text-red-500 hover:text-red-700 h-5 w-5 p-0"
                          >
                            <IconX size={10} />
                          </Button>
                        </div>
                        <Badge variant="secondary" className="text-xs mt-1">{formatFileSize(uploadedFiles[1].size)}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
} 