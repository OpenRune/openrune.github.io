'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconUpload, IconFile, IconX } from '@tabler/icons-react';
import { UploadedFile } from '@/lib/types/performance';
import { formatFileSize } from '@/lib/utils/performance';

interface UploadModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  uploadedFiles: UploadedFile[];
  modalMode: 'single' | 'compare';
  onModalModeChange: (mode: 'single' | 'compare') => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSingleFileUpload: (event: React.ChangeEvent<HTMLInputElement>, fileIndex: number) => void;
  onRemoveFile: (index: number) => void;
  onConfirm: () => void;
  isProcessing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  fileInputRef1: React.RefObject<HTMLInputElement>;
  fileInputRef2: React.RefObject<HTMLInputElement>;
}

export default function UploadModal({
  isOpen,
  onOpenChange,
  uploadedFiles,
  modalMode,
  onModalModeChange,
  onFileUpload,
  onSingleFileUpload,
  onRemoveFile,
  onConfirm,
  isProcessing,
  fileInputRef,
  fileInputRef1,
  fileInputRef2
}: UploadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload JSON Files for Analysis</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={modalMode} onValueChange={(value) => onModalModeChange(value as 'single' | 'compare')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single File</TabsTrigger>
              <TabsTrigger value="compare">Compare Files</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={onFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="flex items-center gap-2 mx-auto"
                  disabled={uploadedFiles.length >= 1}
                >
                  <IconUpload size={16} />
                  Select JSON File
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Select a single JSON file to analyze
                </p>
                {uploadedFiles.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {uploadedFiles.length}/1 file selected
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="compare" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef1}
                    type="file"
                    accept=".json"
                    onChange={(e) => onSingleFileUpload(e, 0)}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef1.current?.click()}
                    variant="outline"
                    className="flex items-center gap-2 mx-auto"
                    disabled={uploadedFiles[0] !== undefined}
                  >
                    <IconUpload size={16} />
                    Select First File
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    First file to compare
                  </p>
                  {uploadedFiles[0] && (
                    <div className="mt-2 p-2 bg-muted rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{uploadedFiles[0].name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveFile(0)}
                          className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <IconX size={12} />
                        </Button>
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">{formatFileSize(uploadedFiles[0].size)}</Badge>
                    </div>
                  )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef2}
                    type="file"
                    accept=".json"
                    onChange={(e) => onSingleFileUpload(e, 1)}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef2.current?.click()}
                    variant="outline"
                    className="flex items-center gap-2 mx-auto"
                    disabled={uploadedFiles[1] !== undefined}
                  >
                    <IconUpload size={16} />
                    Select Second File
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Second file to compare
                  </p>
                  {uploadedFiles[1] && (
                    <div className="mt-2 p-2 bg-muted rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{uploadedFiles[1].name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveFile(1)}
                          className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <IconX size={12} />
                        </Button>
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">{formatFileSize(uploadedFiles[1].size)}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Selected Files:</h3>
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <IconFile size={16} />
                    <span className="font-medium">{file.name}</span>
                    <Badge variant="secondary">{formatFileSize(file.size)}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <IconX size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={uploadedFiles.length === 0 || isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Confirm & Analyze'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 