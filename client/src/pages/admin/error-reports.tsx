import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ErrorReportStatus } from '@shared/schema/error-report';

export default function ErrorReportsPage() {
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: reports,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['errorReports'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/error-reports');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
      } catch (err) {
        console.error('Error fetching reports:', err);
        throw err;
      }
    },
    retry: 1, // Try once more in case of temporary network issues
  });

  const updateReport = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest('PATCH', `/api/error-reports/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['errorReports'] });
      toast({
        title: 'Report updated',
        description: 'The error report has been updated successfully.',
      });
      setSelectedReport(null);
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Failed to update the error report. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const statusColors = {
    new: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  if (isLoading) {
    return <div className="container mx-auto py-10">Loading...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
          {error instanceof Error ? (
            <>
              {error.message.includes('401') ? (
                <>
                  <h3 className="font-bold mb-2">Access Denied</h3>
                  <p>
                    You do not have permission to view error reports. Please contact an
                    administrator.
                  </p>
                </>
              ) : error.message.includes('500') ? (
                <>
                  <h3 className="font-bold mb-2">Server Error</h3>
                  <p>There was a problem loading the error reports. Please try again later.</p>
                  <p className="text-sm mt-2">If this persists, contact technical support.</p>
                </>
              ) : (
                <>
                  <h3 className="font-bold mb-2">Error</h3>
                  <p>{error.message}</p>
                </>
              )}
            </>
          ) : (
            'An unexpected error occurred. Please try again later.'
          )}
        </div>
        <Button
          className="mt-4"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['errorReports'] })}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Error Reports</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Error</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports?.map((report: any) => (
            <TableRow key={report.id}>
              <TableCell>{format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')}</TableCell>
              <TableCell className="max-w-md truncate">{report.errorMessage}</TableCell>
              <TableCell>{report.userEmail || 'Anonymous'}</TableCell>
              <TableCell>
                <Badge className={statusColors[report.status as keyof typeof statusColors]}>
                  {report.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Error Report Details</DialogTitle>
              <DialogDescription>
                Review and update the status of this error report
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Error Message</h3>
                <pre className="text-sm bg-gray-50 p-3 rounded">{selectedReport.errorMessage}</pre>
              </div>

              {selectedReport.errorStack && (
                <div>
                  <h3 className="font-medium mb-1">Stack Trace</h3>
                  <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto max-h-40">
                    {selectedReport.errorStack}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-1">User Description</h3>
                <p className="text-sm bg-gray-50 p-3 rounded">{selectedReport.userDescription}</p>
              </div>

              {selectedReport.screenshotUrls?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Screenshots</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedReport.screenshotUrls.map((url: string, index: number) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Error screenshot ${index + 1}`}
                        className="rounded border"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-1">Status</h3>
                  <Select
                    value={selectedReport.status}
                    onValueChange={(value) => {
                      updateReport.mutate({
                        id: selectedReport.id,
                        data: { status: value },
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ErrorReportStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h3 className="font-medium mb-1">Admin Notes</h3>
                  <Textarea
                    value={selectedReport.adminNotes || ''}
                    onChange={(e) => {
                      updateReport.mutate({
                        id: selectedReport.id,
                        data: { adminNotes: e.target.value },
                      });
                    }}
                    placeholder="Add notes about this error..."
                  />
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p>URL: {selectedReport.url}</p>
                <p>User Agent: {selectedReport.userAgent}</p>
                <p>Created: {format(new Date(selectedReport.createdAt), 'PPpp')}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
