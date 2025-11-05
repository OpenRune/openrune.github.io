'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SseConnection } from '@/lib/sse/fetchSSE';
import { ZipProgressResponse } from '@/lib/sse/types';
import { fetchFromBuildUrl } from '@/lib/api/apiClient';

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'SPRITES' | 'MODELS' | 'TEXTURES';
  backendUrl: string;
}

export function DownloadDialog({ open, onOpenChange, type, backendUrl }: DownloadDialogProps) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Initializing...');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const sseConnectionRef = useRef<SseConnection | null>(null);

  useEffect(() => {
    if (!open) {
      // Clean up when dialog closes
      if (sseConnectionRef.current) {
        sseConnectionRef.current.close();
        sseConnectionRef.current = null;
      }
      setProgress(0);
      setMessage('Initializing...');
      setDownloadUrl(null);
      setError(null);
      setJobId(null);
      return;
    }

    // Start the download process
    const startDownload = async () => {
      try {
        setError(null);
        setMessage('Creating zip job...');
        
        // POST to create zip job
        const response = await fetchFromBuildUrl('/zip/create', { type }, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`Failed to create zip job: ${response.statusText}`);
        }

        const data = await response.json();
        const newJobId = data.jobId;
        setJobId(newJobId);
        setMessage('Job created, waiting for progress...');

        // Connect to SSE for progress updates with jobId
        // Note: fetchSSE doesn't support query params, so we'll use EventSource directly
        const sseUrl = `${backendUrl}/sse?type=ZIP_PROGRESS&jobId=${newJobId}`;
        const eventSource = new EventSource(sseUrl);
        
        eventSource.onopen = () => {
          setMessage('Connected, waiting for progress...');
        };

        eventSource.onmessage = (event: MessageEvent) => {
          try {
            const progressData: ZipProgressResponse = JSON.parse(event.data);
            // Verify it's for this job
            if (progressData.jobId === newJobId) {
              setProgress(progressData.progress);
              setMessage(progressData.message);
              
              if (progressData.downloadUrl) {
                setDownloadUrl(progressData.downloadUrl);
                setMessage('Download ready!');
                eventSource.close();
              }
            }
          } catch (err) {
            setError(`Failed to parse progress data: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        };

        eventSource.onerror = (err) => {
          if (eventSource.readyState === EventSource.CLOSED) {
            if (!downloadUrl) {
              setError('Connection closed unexpectedly');
            }
          } else {
            setError(`Connection error: ${err.type || 'Unknown error'}`);
          }
        };

        sseConnectionRef.current = {
          close: () => eventSource.close(),
          readyState: () => eventSource.readyState,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start download');
      }
    };

    startDownload();

    return () => {
      if (sseConnectionRef.current) {
        sseConnectionRef.current.close();
        sseConnectionRef.current = null;
      }
    };
  }, [open, type, backendUrl]);

  const handleDownload = () => {
    if (downloadUrl) {
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${type.toLowerCase()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Close dialog after download
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    if (sseConnectionRef.current) {
      sseConnectionRef.current.close();
      sseConnectionRef.current = null;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Downloading {type}</DialogTitle>
          <DialogDescription>
            Creating zip file in the background...
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error ? (
            <div className="text-destructive text-sm">{error}</div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{message}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
              {downloadUrl && (
                <Button onClick={handleDownload} className="w-full">
                  Download {type.toLowerCase()}.zip
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

