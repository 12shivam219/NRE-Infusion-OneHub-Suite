import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert'; // Assuming this import
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Assuming this import
import { Send, X, Smile, Clock, Link, Image, AlertTriangle } from 'lucide-react';

// --- MOCK Client-Side Deliverability Utility (Replicating Server Logic) ---
// NOTE: In a real app, this should be an API call or imported from a shared validation library.
// For this example, we mock a quick, client-side check.
const MOCK_LOW_DELIVERABILITY_DOMAINS = ['mailinator.com', 'tempmail.com', 'test.com'];

interface DeliverabilityValidation {
    risk: 'low' | 'medium' | 'high';
    reason?: string;
}

function checkClientSideDeliverability(email: string): DeliverabilityValidation {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !email.includes('@') || email.length < 5) {
        return { risk: 'high', reason: 'Invalid format' };
    }
    if (MOCK_LOW_DELIVERABILITY_DOMAINS.includes(domain)) {
        return { risk: 'high', reason: 'Disposable or known low-deliverability domain.' };
    }
    return { risk: 'low' };
}
// --------------------------------------------------------------------------

// Placeholder for the external RichTextEditor component
const RichTextEditor = ({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder: string }) => (
    <div className="border rounded-md min-h-[200px] p-1 border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {/* TODO: Integrate actual RichTextEditor here (e.g., TinyMCE, TipTap, Lexical) */}
        <textarea
            className="w-full min-h-[200px] p-2 border-none resize-none focus:outline-none"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);


interface ComposeDialogProps {
  open: boolean;
  to: string;
  subject: string;
  body: string;
  attachments: File[];
  isDragActive?: boolean;
  getRootProps?: any;
  getInputProps?: any;
  onClose: () => void;
  onDiscard: () => void;
  onToChange: (to: string) => void;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  onSend: () => void;
  onRemoveAttachment: (index: number) => void;
  // ENHANCEMENT: Activate all quick action handlers
  onEmojiClick: () => void;
  onScheduleClick: () => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  isSending: boolean;
}

function ComposeDialog({
  open,
  onClose,
  to,
  subject,
  body,
  attachments,
  onToChange,
  onSubjectChange,
  onBodyChange,
  onSend,
  onRemoveAttachment,
  onEmojiClick,
  onScheduleClick,
  onInsertLink,
  onInsertImage,
  isSending,
}: ComposeDialogProps) {
    
    // ENHANCEMENT: Client-Side Deliverability Validation Hook
    const { risk, reason } = useMemo(() => {
        if (!to) return { risk: 'low' as const, reason: undefined };
        return checkClientSideDeliverability(to);
    }, [to]);
    
    const isDeliverabilityHighRisk = risk === 'high';

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="to-input" className="text-sm font-medium">To</label>
            <Input
              id="to-input"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
            />
            {/* ENHANCEMENT: Display Client-Side Deliverability Warning */}
            {isDeliverabilityHighRisk && (
                <Alert variant="destructive" className="mt-2 p-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                        **Deliverability Warning:** This recipient email address appears to be high risk. 
                        ({reason || 'Please verify the address.'})
                    </AlertDescription>
                </Alert>
            )}
          </div>
          
          <div>
            <label htmlFor="subject-input" className="text-sm font-medium">Subject</label>
            <Input
              id="subject-input"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <label htmlFor="body-editor" className="text-sm font-medium">Message</label>
            {/* ENHANCEMENT: Replaced textarea with placeholder for RichTextEditor */}
            <RichTextEditor
              value={body}
              onChange={onBodyChange}
              placeholder="Compose your message..."
            />
            
            {/* ENHANCEMENT: Rich Text Editor Toolbar (simplified version) */}
            <div className="flex justify-start space-x-2 mt-2">
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={onEmojiClick} aria-label="Insert Emoji">
                                <Smile className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert Emoji</TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={onInsertLink} aria-label="Insert Link">
                                <Link className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert Link</TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={onInsertImage} aria-label="Insert Image">
                                <Image className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert Image</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Attachments</label>
              <div className="space-y-1">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <TooltipProvider>
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onRemoveAttachment(index)}
                                  // ENHANCEMENT: Accessibility Fix (aria-label)
                                  aria-label={`Remove attachment: ${file.name}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove {file.name}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
                <Button variant="outline" onClick={onClose}>
                    <X className="h-4 w-4 mr-2" />
                    Discard
                </Button>
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <Button variant="outline" onClick={onScheduleClick} aria-label="Schedule Send">
                                <Clock className="h-4 w-4 mr-2" />
                                Schedule
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Schedule email for later</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            
            <Button 
                onClick={onSend} 
                disabled={isSending || !to || !subject || isDeliverabilityHighRisk}
                title={isDeliverabilityHighRisk ? "Cannot send due to high-risk recipient" : undefined}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ComposeDialog };
export default ComposeDialog;