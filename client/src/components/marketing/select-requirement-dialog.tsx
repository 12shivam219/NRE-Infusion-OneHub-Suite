import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Requirement {
  id: string;
  displayId?: string;
  jobTitle?: string;
  status?: string;
  consultantId?: string;
  vendorCompany?: string;
  completeJobDescription?: string;
}

interface SelectRequirementDialogProps {
  open: boolean;
  onClose: () => void;
  onRequirementSelect: (requirement: Requirement) => void;
}

export default function SelectRequirementDialog({
  open,
  onClose,
  onRequirementSelect,
}: SelectRequirementDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>('');

  // Fetch requirements
  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['/api/marketing/requirements', 'all'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketing/requirements?limit=100&page=1');
        if (!response.ok) return [];
        const result = await response.json();
        return (result.data || result) as Requirement[];
      } catch (error) {
        console.error('Error fetching requirements:', error);
        return [] as Requirement[];
      }
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Filter requirements based on search query
  const filteredRequirements = requirements.filter((req) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      req.displayId?.toLowerCase().includes(searchLower) ||
      req.jobTitle?.toLowerCase().includes(searchLower) ||
      req.id.toLowerCase().includes(searchLower)
    );
  });

  const handleRequirementSelect = () => {
    const selectedRequirement = requirements.find((req) => req.id === selectedRequirementId);
    if (selectedRequirement) {
      onRequirementSelect(selectedRequirement);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Requirement</DialogTitle>
          <DialogDescription>
            Choose a requirement to schedule an interview for
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search requirements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Requirements Dropdown */}
          <div className="space-y-2">
            <Select
              value={selectedRequirementId}
              onValueChange={setSelectedRequirementId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a requirement" />
              </SelectTrigger>
              <SelectContent>
                {filteredRequirements.map((req) => (
                  <SelectItem key={req.id} value={req.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>
                        {req.displayId || req.id} - {req.jobTitle || 'Untitled'}
                      </span>
                      {req.status && (
                        <Badge variant="outline" className="ml-2">
                          {req.status}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
                {filteredRequirements.length === 0 && (
                  <div className="p-2 text-center text-sm text-slate-500">
                    {isLoading ? 'Loading...' : 'No requirements found'}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleRequirementSelect}
            disabled={!selectedRequirementId || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}