import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { UploadedFile } from '@/lib/types/performance';

export function useShareLink() {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const createShareLink = async (uploadedFiles: UploadedFile[]) => {
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

  const loadFromShareLink = async (uploadedFiles: UploadedFile[], setUploadedFiles: (files: UploadedFile[]) => void, setIsModalOpen: (open: boolean) => void) => {
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
            toast.error('Share link not found', {
              description: 'This link has expired or is invalid.'
            });
          } else {
            setShareError('Failed to load share link. Please try again.');
            toast.error('Failed to load share link', {
              description: 'Please try again.'
            });
          }
          return;
        }
        
        const storageData = await response.json();
        
        // Check if expired
        if (Date.now() > storageData.expires) {
          setShareError('This share link has expired.');
          toast.error('Share link expired', {
            description: 'This link has expired.'
          });
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
        toast.error('Invalid share link', {
          description: 'The share link could not be loaded.'
        });
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
        toast.error('Invalid share link', {
          description: 'The share link could not be loaded.'
        });
      }
    }
  };

  return {
    shareModalOpen,
    setShareModalOpen,
    shareUrl,
    shareLoading,
    shareError,
    createShareLink,
    copyShareLink,
    loadFromShareLink
  };
} 