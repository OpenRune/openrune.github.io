'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconUpload, IconFile, IconX, IconChartBar, IconClock, IconList, IconChevronDown, IconShare, IconSettings } from '@tabler/icons-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import SummaryTab from '@/components/performance/SummaryTab';
import FramesTab from '@/components/performance/FramesTab';
import TimingMapTab from '@/components/performance/TimingMapTab';
import SettingsTab from '@/components/performance/SettingsTab';
import { UploadedFile, FrameData } from '@/lib/types/performance';
import { formatFileSize, formatMemory, formatTime } from '@/lib/utils/performance';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';

export default function Performance117Page() {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'single' | 'compare'>('single');
  const [dropdownMode, setDropdownMode] = useState<'single' | 'compare'>('single');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [frameLimit, setFrameLimit] = useState<number | 'all'>(20);
  const [isFrameDropdownOpen, setIsFrameDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const dropdownFileInputRef1 = useRef<HTMLInputElement>(null);
  const dropdownFileInputRef2 = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    const maxFiles = modalMode === 'single' ? 1 : 2;

    Array.from(files).forEach((file, index) => {
      if (index >= maxFiles) return; // Only process files up to the limit

      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const jsonData = JSON.parse(e.target?.result as string);
            const uploadedFile: UploadedFile = {
              name: file.name,
              data: jsonData,
              size: file.size
            };
            newFiles.push(uploadedFile);

            if (newFiles.length === Math.min(files.length, maxFiles)) {
              setUploadedFiles(prev => [...prev, ...newFiles]);
            }
          } catch (error) {
            console.error('Error parsing JSON file:', file.name, error);
          }
        };
        reader.readAsText(file);
      }
    });
  };

  const handleSingleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, fileIndex: number) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);
          const uploadedFile: UploadedFile = {
            name: file.name,
            data: jsonData,
            size: file.size
          };
          
          setUploadedFiles(prev => {
            const newFiles = [...prev];
            newFiles[fileIndex] = uploadedFile;
            return newFiles;
          });
        } catch (error) {
          console.error('Error parsing JSON file:', file.name, error);
        }
      };
      reader.readAsText(file);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const createShareLink = async () => {
    if (uploadedFiles.length === 0) return;
    
    try {
      // Create a shareable data object
      const shareData = {
        files: uploadedFiles.map(file => ({
          name: file.name,
          data: file.data,
          size: file.size
        })),
        timestamp: new Date().toISOString()
      };
      
      // Generate a short ID (6 characters)
      const shortId = Math.random().toString(36).substring(2, 8);
      
      // Store on server for 4 hours
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: shortId,
          data: shareData,
          expires: Date.now() + (4 * 60 * 60 * 1000) // 4 hours
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to store share data');
      }
      
      // Create the short share URL
      const shareUrlString = `${window.location.origin}${window.location.pathname}?share=${shortId}`;
      setShareUrl(shareUrlString);
      setShareModalOpen(true);
    } catch (error) {
      console.error('Error creating share link:', error);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link', {
        description: 'Please copy the link manually.'
      });
    }
  };

  const loadFromShareLink = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    const dataParam = urlParams.get('data'); // Keep for backward compatibility
    
    if (shareParam) {
      setShareLoading(true);
      setShareError(null);
      
      try {
        // Load from server
        const response = await fetch(`/api/share?id=${shareParam}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setShareError('This share link has expired or is invalid.');
          } else {
            setShareError('Failed to load share link. Please try again.');
          }
          return;
        }
        
        const storageData = await response.json();
        
        // Check if expired
        if (Date.now() > storageData.expires) {
          setShareError('This share link has expired.');
          return;
        }
        
        // Load the files
        const files = storageData.data.files.map((file: any) => ({
          name: file.name,
          data: file.data,
          size: file.size
        }));
        
        setUploadedFiles(files);
        setIsModalOpen(false);
      } catch (error) {
        console.error('Error loading share link:', error);
        setShareError('Invalid share link.');
      } finally {
        setShareLoading(false);
      }
    } else if (dataParam) {
      // Backward compatibility with old format
      try {
        // Decode and decompress the data
        const jsonString = decodeURIComponent(escape(atob(dataParam)));
        const shareData = JSON.parse(jsonString);
        
        // Load the files
        const files = shareData.files.map((file: any) => ({
          name: file.name,
          data: file.data,
          size: file.size
        }));
        
        setUploadedFiles(files);
        setIsModalOpen(false);
      } catch (error) {
        console.error('Error loading share link:', error);
        setShareError('Invalid share link.');
      }
    }
  };

  const handleConfirm = () => {
    setIsProcessing(true);
    // Simulate processing time
    setTimeout(() => {
      setIsProcessing(false);
      setIsModalOpen(false);
    }, 1000);
  };

  const getFramesData = (): FrameData[] => {
    const frames: FrameData[] = [];
    uploadedFiles.forEach(file => {
      if (file.data.frames && Array.isArray(file.data.frames)) {
        // Apply frame limit
        const framesToProcess = frameLimit === 'all' 
          ? file.data.frames 
          : file.data.frames.slice(0, frameLimit as number);
          
        // Process each frame to add computed fields
        const processedFrames = framesToProcess.map((frame: any, index: number) => {
          const processedFrame: FrameData = {
            ...frame,
            // Compute elapsed time (relative to first frame)
            elapsed: index === 0 ? 0 : frame.timestamp - framesToProcess[0].timestamp,
            // Compute total CPU time
            cpuTime: frame.cpu ? Object.values(frame.cpu).reduce((sum: number, val: any) => sum + (val || 0), 0) : 0,
            // Compute total GPU time  
            gpuTime: frame.gpu ? Object.values(frame.gpu).reduce((sum: number, val: any) => sum + (val || 0), 0) : 0,
            // Create combined timing map
            timingMap: {
              ...frame.cpu,
              ...frame.gpu
            }
          };
          
          // Determine bottleneck
          processedFrame.bottleneck = (processedFrame.cpuTime || 0) > (processedFrame.gpuTime || 0) ? 'CPU' : 'GPU';
          
          // Estimate FPS based on total frame time
          const totalFrameTime = (processedFrame.cpuTime || 0) + (processedFrame.gpuTime || 0);
          processedFrame.estimatedFps = totalFrameTime > 0 ? 1000000000 / totalFrameTime : 0; // nanoseconds to FPS
          
          return processedFrame;
        });
        frames.push(...processedFrames);
      }
    });
    return frames;
  };

  const getFramesDataByFile = (fileIndex: number): FrameData[] => {
    if (fileIndex >= uploadedFiles.length) return [];
    const file = uploadedFiles[fileIndex];
    if (file.data.frames && Array.isArray(file.data.frames)) {
      // Apply frame limit
      const framesToProcess = frameLimit === 'all' 
        ? file.data.frames 
        : file.data.frames.slice(0, frameLimit as number);
        
      // Process frames for this specific file
      return framesToProcess.map((frame: any, index: number) => {
        const processedFrame: FrameData = {
          ...frame,
          // Compute elapsed time (relative to first frame)
          elapsed: index === 0 ? 0 : frame.timestamp - framesToProcess[0].timestamp,
          // Compute total CPU time
          cpuTime: frame.cpu ? Object.values(frame.cpu).reduce((sum: number, val: any) => sum + (val || 0), 0) : 0,
          // Compute total GPU time  
          gpuTime: frame.gpu ? Object.values(frame.gpu).reduce((sum: number, val: any) => sum + (val || 0), 0) : 0,
          // Create combined timing map
          timingMap: {
            ...frame.cpu,
            ...frame.gpu
          }
        };
        
        // Determine bottleneck
        processedFrame.bottleneck = (processedFrame.cpuTime || 0) > (processedFrame.gpuTime || 0) ? 'CPU' : 'GPU';
        
        // Estimate FPS based on total frame time
        const totalFrameTime = (processedFrame.cpuTime || 0) + (processedFrame.gpuTime || 0);
        processedFrame.estimatedFps = totalFrameTime > 0 ? 1000000000 / totalFrameTime : 0; // nanoseconds to FPS
        
        return processedFrame;
      });
    }
    return [];
  };

  const getTimingMapKeys = (): string[] => {
    const frames = getFramesData();
    if (frames.length === 0) return [];

    const firstFrame = frames[0];
    return Object.keys(firstFrame.timingMap || {});
  };

  const getPluginSettings = (): any => {
    if (uploadedFiles.length === 0) return null;
    // Get settings from the first file (assuming all files have same settings)
    const firstFile = uploadedFiles[0];
    return firstFile.data.settings || null;
  };

  const renderJsonData = (data: any, depth = 0) => {
    if (depth > 3) return <span className="text-muted-foreground">...</span>;

    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return (
          <div className="ml-4">
            <span className="text-blue-600">[</span>
            {data.slice(0, 5).map((item, index) => (
              <div key={index} className="ml-4">
                {renderJsonData(item, depth + 1)}
                {index < Math.min(data.length - 1, 4) && <span className="text-gray-400">,</span>}
              </div>
            ))}
            {data.length > 5 && <span className="text-muted-foreground">... ({data.length - 5} more)</span>}
            <span className="text-blue-600">]</span>
          </div>
        );
      } else {
        const keys = Object.keys(data);
        return (
          <div className="ml-4">
            <span className="text-green-600">{'{'}</span>
            {keys.slice(0, 5).map((key, index) => (
              <div key={key} className="ml-4">
                <span className="text-purple-600">"{key}"</span>
                <span className="text-gray-400">: </span>
                {renderJsonData(data[key], depth + 1)}
                {index < Math.min(keys.length - 1, 4) && <span className="text-gray-400">,</span>}
              </div>
            ))}
            {keys.length > 5 && <span className="text-muted-foreground">... ({keys.length - 5} more keys)</span>}
            <span className="text-green-600">{'}'}</span>
          </div>
        );
      }
    } else {
      return <span className="text-orange-600">{JSON.stringify(data)}</span>;
    }
  };

  const frames = getFramesData();
  const timingMapKeys = getTimingMapKeys();
  const isCompareMode = uploadedFiles.length > 1;

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isFileDropdownOpen && !(event.target as Element).closest('.file-dropdown')) {
        setIsFileDropdownOpen(false);
      }
      if (isFrameDropdownOpen && !(event.target as Element).closest('.frame-dropdown')) {
        setIsFrameDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFileDropdownOpen, isFrameDropdownOpen]);

  // Load data from share link on page load
  React.useEffect(() => {
    loadFromShareLink();
  }, []);

  return (
    <PageContainer scrollable={true}>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">117 Performance Analysis</h1>
        <div className="flex items-center gap-2">
          {uploadedFiles.length > 0 && (
            <>
              <div className="relative frame-dropdown">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => setIsFrameDropdownOpen(!isFrameDropdownOpen)}
                >
                  <IconChartBar size={16} />
                  {frameLimit === 'all' ? 'All Frames' : `${frameLimit} Frames`}
                  <IconChevronDown size={16} />
                </Button>
                {isFrameDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-40 bg-popover border rounded-lg shadow-lg z-50">
                    <div className="p-2 space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Frame Limit</div>
                      {(['all', 20, 40, 60, 80, 100, 120, 140, 160, 180, 200] as const).map((limit) => (
                        <button
                          key={limit}
                          className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-muted ${
                            frameLimit === limit ? 'bg-muted font-medium' : ''
                          }`}
                          onClick={() => {
                            setFrameLimit(limit);
                            setIsFrameDropdownOpen(false);
                          }}
                        >
                          {limit === 'all' ? 'All Frames' : `${limit} Frames`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                      onClick={createShareLink}
                    >
                      <IconShare size={16} />
                      Share
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a shareable link with your data</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="relative file-dropdown">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => setIsFileDropdownOpen(!isFileDropdownOpen)}
                >
                  <IconFile size={16} />
                  Files
                  <IconChevronDown size={16} />
                </Button>
              {isFileDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-96 bg-popover border rounded-lg shadow-lg z-50">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Uploaded Files</h3>
                        </div>

                    <Tabs value={dropdownMode} onValueChange={(value) => setDropdownMode(value as 'single' | 'compare')} className="w-full">
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
                            onChange={(e) => handleSingleFileUpload(e, 0)}
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
                                  onClick={() => removeFile(0)}
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
                              onChange={(e) => handleSingleFileUpload(e, 0)}
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
                                    onClick={() => removeFile(0)}
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
                              onChange={(e) => handleSingleFileUpload(e, 1)}
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
                                    onClick={() => removeFile(1)}
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
            </>
          )}
          {uploadedFiles.length === 0 && !shareLoading && (
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <IconUpload size={16} />
              Upload Files
            </Button>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <Dialog open={isModalOpen && !shareLoading} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload JSON Files for Analysis</DialogTitle>
            {shareError && (
              <p className="text-sm text-red-600 mt-2">
                Share link invalid - please upload your own files
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <Tabs value={modalMode} onValueChange={(value) => setModalMode(value as 'single' | 'compare')} className="w-full">
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
                onChange={handleFileUpload}
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
                      onChange={(e) => handleSingleFileUpload(e, 0)}
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
                            onClick={() => removeFile(0)}
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
                      onChange={(e) => handleSingleFileUpload(e, 1)}
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
                            onClick={() => removeFile(1)}
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
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <IconX size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={uploadedFiles.length === 0 || isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Confirm & Analyze'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Performance Analysis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg inline-block">
                <QRCodeSVG value={shareUrl} size={200} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Scan the QR code or copy the link below to share your performance analysis.
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Link expires in 4 hours
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <Button
                onClick={copyShareLink}
                variant="outline"
                size="sm"
                className="flex-shrink-0"
              >
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Display */}
      {uploadedFiles.length > 0 && !isModalOpen && (
        <div className="space-y-6">
          {isCompareMode ? (
            // Compare Mode - Side by Side
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Performance Comparison</h2>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{uploadedFiles[0]?.name}</Badge>
                  <span className="text-muted-foreground">vs</span>
                  <Badge variant="outline">{uploadedFiles[1]?.name}</Badge>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary" className="flex items-center gap-2">
                    <IconChartBar size={16} />
                    Summary
                  </TabsTrigger>
                  <TabsTrigger value="frames" className="flex items-center gap-2">
                    <IconClock size={16} />
                    Frames
                  </TabsTrigger>
                  <TabsTrigger value="timingmap" className="flex items-center gap-2">
                    <IconList size={16} />
                    Timing Map
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex items-center gap-2">
                    <IconSettings size={16} />
                    Settings
                  </TabsTrigger>
                </TabsList>

                                                                  <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{uploadedFiles[0]?.name}</h3>
                <SummaryTab 
                  frames={getFramesDataByFile(0)}
                  getTimingMapKeys={getTimingMapKeys}
                  formatTime={formatTime}
                  formatMemory={formatMemory}
                  compareMode={true}
                  snapshotData={uploadedFiles[0]?.data}
                />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{uploadedFiles[1]?.name}</h3>
                    <SummaryTab
                      frames={getFramesDataByFile(1)}
                      getTimingMapKeys={getTimingMapKeys}
                      formatTime={formatTime}
                      formatMemory={formatMemory}
                      compareMode={true}
                      snapshotData={uploadedFiles[1]?.data}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="frames" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{uploadedFiles[0]?.name}</h3>
                    <FramesTab
                      frames={getFramesDataByFile(0)}
                      formatTime={formatTime}
                      formatMemory={formatMemory}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{uploadedFiles[1]?.name}</h3>
                    <FramesTab
                      frames={getFramesDataByFile(1)}
                      formatTime={formatTime}
                      formatMemory={formatMemory}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="timingmap" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{uploadedFiles[0]?.name}</h3>
                    <TimingMapTab
                      frames={getFramesDataByFile(0)}
                      getTimingMapKeys={getTimingMapKeys}
                      formatTime={formatTime}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{uploadedFiles[1]?.name}</h3>
                    <TimingMapTab
                      frames={getFramesDataByFile(1)}
                      getTimingMapKeys={getTimingMapKeys}
                      formatTime={formatTime}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{uploadedFiles[0]?.name}</h3>
                    <SettingsTab
                      pluginSettings={getPluginSettings()}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{uploadedFiles[1]?.name}</h3>
                    <SettingsTab
                      pluginSettings={getPluginSettings()}
                    />
                  </div>
                </div>
              </TabsContent>
              </Tabs>
            </div>
          ) : (
            // Single Mode - Normal Display
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary" className="flex items-center gap-2">
                <IconChartBar size={16} />
                Summary
              </TabsTrigger>
              <TabsTrigger value="frames" className="flex items-center gap-2">
                <IconClock size={16} />
                Frames ({frames.length})
              </TabsTrigger>
              <TabsTrigger value="timingmap" className="flex items-center gap-2">
                <IconList size={16} />
                Timing Map ({timingMapKeys.length})
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <IconSettings size={16} />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
                <SummaryTab
                  frames={frames}
                  getTimingMapKeys={getTimingMapKeys}
                  formatTime={formatTime}
                  formatMemory={formatMemory}
                  snapshotData={uploadedFiles[0]?.data}
                />
            </TabsContent>

            <TabsContent value="frames" className="space-y-4">
                <FramesTab
                  frames={frames}
                  formatTime={formatTime}
                  formatMemory={formatMemory}
                />
            </TabsContent>

            <TabsContent value="timingmap" className="space-y-4">
                <TimingMapTab
                  frames={frames}
                  getTimingMapKeys={getTimingMapKeys}
                  formatTime={formatTime}
                />
             </TabsContent>

            <TabsContent value="settings" className="space-y-4">
                <SettingsTab
                  pluginSettings={getPluginSettings()}
                />
             </TabsContent>
          </Tabs>
          )}
        </div>
      )}

      {uploadedFiles.length === 0 && !isModalOpen && (
        <div className="text-center py-12">
          {shareLoading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Loading shared data...</h3>
              <p className="text-muted-foreground">
                Please wait while we load the performance data
              </p>
            </>
          ) : shareError ? (
            <>
              <IconFile size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-red-600">Share Link Error</h3>
              <p className="text-muted-foreground mb-4">
                {shareError}
              </p>
              <Button
                onClick={() => setIsModalOpen(true)}
                variant="outline"
                className="flex items-center gap-2 mx-auto"
              >
                <IconUpload size={16} />
                Upload Your Own Files
              </Button>
            </>
          ) : (
            <>
              <IconFile size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Uploaded</h3>
              <p className="text-muted-foreground">
                Upload JSON files to start analyzing performance data
              </p>
            </>
          )}
        </div>
      )}
      </div>
    </PageContainer>
  );
} 