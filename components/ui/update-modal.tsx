'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IconSparkles } from '@tabler/icons-react';
import { APP_VERSION } from '@/lib/constants/appConfig';

interface UpdateModalProps {
  version: string;
  content: string;
  onClose: () => void;
}

function UpdateModal({ version, content, onClose }: UpdateModalProps) {
  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[50%] max-h-[80vh] overflow-hidden flex flex-col"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <IconSparkles className="h-5 w-5 text-yellow-500" />
            Update {version}
          </DialogTitle>
          <DialogDescription>
            Here's what's new in this version
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
          />
        </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose} variant="default">
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple markdown formatter
function formatMarkdown(markdown: string): string {
  let html = markdown;
  
  // Split into lines for processing
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines (they'll be handled as paragraph breaks)
    if (!line) {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push('');
      continue;
    }
    
    // Headers
    if (line.startsWith('### ')) {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(`<h3 class="text-lg font-semibold mt-4 mb-2">${line.substring(4)}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(`<h2 class="text-xl font-bold mt-6 mb-3">${line.substring(3)}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(`<h1 class="text-2xl font-bold mt-6 mb-4">${line.substring(2)}</h1>`);
      continue;
    }
    
    // List items
    if (line.startsWith('- ')) {
      if (!inList) {
        processedLines.push('<ul class="list-disc space-y-1 my-2 ml-4">');
        inList = true;
      }
      processedLines.push(`<li>${line.substring(2)}</li>`);
      continue;
    }
    
    // Regular paragraph
    if (inList) {
      processedLines.push('</ul>');
      inList = false;
    }
    processedLines.push(line);
  }
  
  // Close any open list
  if (inList) {
    processedLines.push('</ul>');
  }
  
  // Join and process inline formatting
  html = processedLines.join('\n');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code
  html = html.replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>');
  
  // Process paragraphs
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // If it's already an HTML tag, don't wrap in paragraph
    if (trimmed.startsWith('<')) {
      return trimmed;
    }
    return `<p class="mb-3 leading-relaxed">${trimmed}</p>`;
  }).filter(Boolean).join('\n');
  
  return html;
}

export default function UpdateModalWrapper() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateContent, setUpdateContent] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Helper function to reset seen updates (for testing)
    // Run this in console: localStorage.removeItem('seen-updates')
    // Or: (window as any).resetUpdates = () => localStorage.removeItem('seen-updates')
    if (typeof window !== 'undefined') {
      (window as any).resetUpdates = () => {
        localStorage.removeItem('seen-updates');
        console.log('Update notifications reset! Refresh the page to see the update modal.');
      };
    }

    const checkForUpdates = async () => {
      try {
        // Check if user has seen this version
        const seenVersions = JSON.parse(
          localStorage.getItem('seen-updates') || '[]'
        ) as string[];

        // If already seen current version, don't show
        if (seenVersions.includes(APP_VERSION)) {
          return;
        }

        // Try to fetch the update file
        const updatePath = `/updates/update-${APP_VERSION}.md`;
        const response = await fetch(updatePath);

        if (response.ok) {
          const content = await response.text();
          setUpdateContent(content);
          setUpdateVersion(APP_VERSION);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    // Small delay to ensure page is loaded
    const timer = setTimeout(checkForUpdates, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    if (updateVersion) {
      // Mark this version as seen
      const seenVersions = JSON.parse(
        localStorage.getItem('seen-updates') || '[]'
      ) as string[];
      
      if (!seenVersions.includes(updateVersion)) {
        seenVersions.push(updateVersion);
        localStorage.setItem('seen-updates', JSON.stringify(seenVersions));
      }
    }
    
    setIsOpen(false);
    setUpdateVersion(null);
    setUpdateContent('');
  };

  if (!isOpen || !updateVersion) {
    return null;
  }

  return (
    <UpdateModal
      version={updateVersion}
      content={updateContent}
      onClose={handleClose}
    />
  );
}

