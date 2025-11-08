import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, refreshCSRFToken } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CreditCard as Edit,
  Eye,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { toast } from 'sonner';

const AdvancedRequirementsForm = lazy(() => import('./advanced-requirements-form'));
const NextStepComments = lazy(() => import('./next-step-comments'));
const InterviewForm = lazy(() => import('./interview-form'));
const AdminDeleteButton = lazy(() =>
  import('./admin-delete-button').then((mod) => ({ default: mod.AdminDeleteButton }))
);
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';
import { RequirementCardSkeleton } from '@/components/ui/card-skeleton';
import { AuditLogDialog } from '@/components/audit-log-dialog';
import { History } from 'lucide-react';
import { EditableField } from '@/components/ui/editable-field';

export default function RequirementsSection() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<any>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [viewRequirement, setViewRequirement] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [selectedRequirementForInterview, setSelectedRequirementForInterview] = useState<any>(null);

  // Debounce search query to reduce API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch consultants for assignment
  const { data: consultants = [] } = useQuery({
    queryKey: ['/api/marketing/consultants', 'all'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent excessive refetches
    gcTime: 10 * 60 * 1000, // Keep in garbage collection for 10 minutes
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketing/consultants?limit=100&page=1');
        if (!response.ok) return [];

        const result = await response.json();
        // API returns { data: consultants[], pagination: {...} }
        const data = result.data || result;
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching consultants:', error);
        return [] as any[];
      }
    },
    retry: 1,
  });

  // Fetch requirements with pagination and filtering
  const {
    data: requirementsResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['/api/marketing/requirements', currentPage, pageSize, statusFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });

      if (statusFilter && statusFilter !== 'All') {
        params.append('status', statusFilter);
      }

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await apiRequest('GET', `/api/marketing/requirements?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch requirements');
      }
      return response.json();
    },
    staleTime: 30000,
    retry: 2,
  });

  // Since we now filter on the backend, we can just use the requirements directly
  const requirements = requirementsResponse?.data || [];
  const pagination = requirementsResponse?.pagination || {
    page: currentPage,
    limit: pageSize,
    total: 0,
    totalPages: 0,
  };

  const filteredRequirements = requirements;
  const statusOptions = ['All', 'New', 'In Progress', 'Submitted', 'Closed'];

  // Create requirement mutation
  const createMutation = useMutation({
    mutationFn: async (requirementData: any) => {
      console.log('API call starting with data:', requirementData);
      const requestData = {
        single: true,
        ...requirementData, // Keep all the form fields at top level
      };
      console.log('Sending request with data:', requestData);
      const response = await apiRequest('POST', '/api/marketing/requirements', requestData);
      console.log('API response status:', response.status, response.ok);
      if (!response.ok) {
        const error = await response.json();
        console.error('API error response:', error);
        throw new Error(error.message || 'Failed to create requirement');
      }
      const result = await response.json();
      console.log('API success response:', result);
      return result;
    },
    onSuccess: async () => {
      // Invalidate only the current page's requirements to avoid unnecessary refetches
      queryClient.invalidateQueries({
        queryKey: [
          '/api/marketing/requirements',
          currentPage,
          pageSize,
          statusFilter,
          debouncedSearch,
        ],
      });
      toast.success('Requirement created successfully!');
      handleFormClose();
      // Refresh CSRF token for future operations
      await refreshCSRFToken();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create requirement');
    },
  });

  // Update requirement mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/marketing/requirements/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update requirement');
      }
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate only the current page's requirements to avoid unnecessary refetches
      queryClient.invalidateQueries({
        queryKey: [
          '/api/marketing/requirements',
          currentPage,
          pageSize,
          statusFilter,
          debouncedSearch,
        ],
      });
      toast.success('Requirement updated successfully!');
      handleFormClose();
      // Refresh CSRF token for future operations
      await refreshCSRFToken();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update requirement');
    },
  });

  // Delete requirement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/marketing/requirements/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete requirement');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate only the current page's requirements to avoid unnecessary refetches
      queryClient.invalidateQueries({
        queryKey: [
          '/api/marketing/requirements',
          currentPage,
          pageSize,
          statusFilter,
          debouncedSearch,
        ],
      });
      toast.success('Requirement deleted successfully!');
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete requirement');
    },
  });

  // Stabilize form props to prevent unnecessary re-renders
  const formInitialData = useMemo(() => {
    return showEditForm ? selectedRequirement : null;
  }, [showEditForm, selectedRequirement?.id]); // Only depend on ID to avoid object reference changes

  const handleFormSubmit = useCallback(
    async (requirementData: any[]) => {
      console.log('Parent handleFormSubmit called with:', requirementData);
      console.log('showEditForm:', showEditForm, 'selectedRequirement:', selectedRequirement);

      if (showEditForm && selectedRequirement) {
        // Update existing requirement
        console.log('Updating requirement with ID:', selectedRequirement.id);
        await updateMutation.mutateAsync({
          id: selectedRequirement.id,
          data: requirementData[0],
        });
      } else {
        // Create new requirement
        console.log('Creating new requirement');
        await createMutation.mutateAsync(requirementData[0]);
      }
    },
    [showEditForm, selectedRequirement?.id, updateMutation, createMutation]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-blue-100 text-blue-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'Submitted':
        return 'bg-orange-100 text-orange-800';
      case 'Closed':
        return 'bg-green-100 text-green-800';
      case 'Applied':
        return 'bg-purple-100 text-purple-800';
      case 'Interviewed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddRequirement = () => {
    setSelectedRequirement(null);
    setShowRequirementForm(true);
  };

  const handleEditRequirement = (requirement: any) => {
    setSelectedRequirement(requirement);
    setShowEditForm(true);
  };

  const handleFormClose = () => {
    setShowRequirementForm(false);
    setShowEditForm(false);
    setSelectedRequirement(null);
  };

  // Mutation for updating a single field
  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const response = await apiRequest('PATCH', `/api/marketing/requirements/${id}`, {
        [field]: value,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update field');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update the viewRequirement state with the new value
      setViewRequirement((prev: any) => ({
        ...prev,
        [variables.field]: variables.value,
      }));

      // Invalidate the requirements query to refresh the list
      queryClient.invalidateQueries({
        queryKey: [
          '/api/marketing/requirements',
          currentPage,
          pageSize,
          statusFilter,
          debouncedSearch,
        ],
      });

      toast.success('Field updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update field');
    },
  });

  const handleViewRequirement = (requirement: any) => {
    setViewRequirement(requirement);
  };

  const handleDeleteRequirement = async (id: string): Promise<void> => {
    setDeleteConfirm(id);
    return Promise.resolve();
  };

  // Create interview mutation
  const createInterviewMutation = useMutation({
    mutationFn: async (interviewData: any) => {
      console.log('Sending interview data to API:', interviewData);
      const response = await apiRequest('POST', '/api/marketing/interviews', interviewData);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText };
        }
        throw new Error(error.message || 'Failed to create interview');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Interview created successfully!');
      setShowInterviewForm(false);
      setSelectedRequirementForInterview(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create interview');
    },
  });

  const handleCreateInterview = (requirement: any) => {
    console.log('Creating interview for requirement:', requirement);
    setSelectedRequirementForInterview(requirement);
    setShowInterviewForm(true);
  };

  const handleInterviewFormSubmit = async (interviewData: any) => {
    console.log('Submitting interview data:', interviewData);
    await createInterviewMutation.mutateAsync(interviewData);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteMutation.mutateAsync(deleteConfirm);
    }
  };

  const getConsultantName = (consultantId: string) => {
    const consultant = consultants.find((c: any) => c.id === consultantId);
    return consultant?.name || 'Unassigned';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Requirements</h2>
            <p className="text-sm text-slate-600 mt-1">Manage job requirements and assignments</p>
          </div>
          <Button disabled className="bg-blue-600 hover:bg-blue-700">
            <Plus size={16} className="mr-2" />
            New Requirement
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by title, company, or tech stack..."
              disabled
              className="pl-10"
            />
          </div>
          <select
            disabled
            className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white hover:bg-slate-50 focus:ring-2 focus:ring-blue-500"
          >
            <option>All</option>
          </select>
        </div>

        {/* Skeleton Cards */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <RequirementCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="text-center py-16">
        <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center shadow-md">
          <AlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Failed to load requirements</h3>
        <p className="text-slate-500 mb-6">
          {error?.message || 'An error occurred while fetching requirements'}
        </p>
        <Button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/requirements'] })
          }
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundaryWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Requirements</h2>
            <p className="text-sm text-slate-600 mt-1">Manage job requirements and assignments</p>
          </div>
          <Button onClick={handleAddRequirement} className="bg-blue-600 hover:bg-blue-700">
            <Plus size={16} className="mr-2" />
            New Requirement
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by title, company, or tech stack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white hover:bg-slate-50 focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {/* Requirements List */}
        <div className="space-y-3">
          {filteredRequirements.map((requirement: any) => (
            <Card
              key={requirement.id}
              className="border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-base text-slate-900 truncate">
                        {requirement.displayId ? `${requirement.displayId} - ` : ''}
                        {requirement.jobTitle}
                      </h3>
                      <Badge className={`${getStatusColor(requirement.status)} shrink-0`}>
                        {requirement.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Client</span>
                        <p className="text-slate-900 font-medium truncate">
                          {requirement.clientCompany}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Applied For</span>
                        <p className="text-slate-900 font-medium truncate">
                          {requirement.appliedFor || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tech Stack</span>
                        <p className="text-slate-900 font-medium truncate">
                          {requirement.primaryTechStack}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Created</span>
                        <p className="text-slate-900 font-medium">
                          {new Date(requirement.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewRequirement(requirement)}
                      className="h-8 w-8 p-0"
                      title="View details"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRequirement(requirement)}
                      className="h-8 w-8 p-0"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCreateInterview(requirement)}
                      className="h-8 w-8 p-0 hover:text-blue-600 hover:bg-blue-50"
                      title="Create Interview"
                    >
                      <Calendar size={16} />
                    </Button>
                    <Suspense
                      fallback={
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
                          <Loader2 size={16} className="animate-spin" />
                        </Button>
                      }
                    >
                      <AdminDeleteButton
                        onDelete={() => handleDeleteRequirement(requirement.id)}
                        className="h-8 w-8 p-0 hover:text-red-600 hover:bg-red-50"
                      >
                        {deleteMutation.isPending && deleteConfirm === requirement.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </AdminDeleteButton>
                    </Suspense>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination Controls */}
        {pagination.total > 0 && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={pagination.total}
            totalPages={pagination.totalPages}
            hasNextPage={currentPage < pagination.totalPages}
            hasPreviousPage={currentPage > 1}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            showPageSize={true}
            showPageInfo={true}
          />
        )}

        {/* Empty States */}
        {filteredRequirements.length === 0 && pagination.total > 0 && (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No matching requirements
              </h3>
              <p className="text-slate-600 mb-4">Try adjusting your search or filters</p>
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setCurrentPage(1);
                }}
                variant="outline"
                size="sm"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {pagination.total === 0 && (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No requirements yet</h3>
              <p className="text-slate-600 mb-4">Create your first requirement to get started</p>
              <Button onClick={handleAddRequirement} className="bg-blue-600 hover:bg-blue-700">
                <Plus size={16} className="mr-2" />
                Create Requirement
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Requirements Form */}
      <Suspense fallback={<div className="p-4">Loading form...</div>}>
        <AdvancedRequirementsForm
          open={showRequirementForm || showEditForm}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          consultants={consultants}
          initialData={formInitialData}
          editMode={showEditForm}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      </Suspense>

      {/* View Requirement Dialog */}
      {viewRequirement && (
        <Dialog open={!!viewRequirement} onOpenChange={() => setViewRequirement(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText size={20} />
                <span>{viewRequirement.jobTitle}</span>
              </DialogTitle>
              <DialogDescription>View requirement details</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Status</label>
                    <div className="text-slate-600">
                      <Badge className={getStatusColor(viewRequirement.status)}>
                        {viewRequirement.status}
                      </Badge>
                    </div>
                  </div>

                  <EditableField
                    label="Job Title"
                    value={viewRequirement.jobTitle}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'jobTitle',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Applied For"
                    value={viewRequirement.appliedFor || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'appliedFor',
                        value,
                      })
                    }
                  />

                  <div>
                    <label className="text-sm font-semibold text-slate-700">Assigned Consultant</label>
                    <p className="text-slate-600">
                      {getConsultantName(viewRequirement.consultantId)}
                    </p>
                  </div>

                  <EditableField
                    label="Primary Tech Stack"
                    value={viewRequirement.primaryTechStack}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'primaryTechStack',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Rate"
                    value={viewRequirement.rate || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'rate',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Duration"
                    value={viewRequirement.duration || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'duration',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Remote Policy"
                    value={viewRequirement.remote || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'remote',
                        value,
                      })
                    }
                  />

                  <div>
                    <label className="text-sm font-semibold text-slate-700">Created</label>
                    <p className="text-slate-600">
                      {new Date(viewRequirement.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">Last Updated</label>
                    <p className="text-slate-600">
                      {viewRequirement.updatedAt ? new Date(viewRequirement.updatedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Client & IMP Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Client & IMP Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <EditableField
                    label="Client Company"
                    value={viewRequirement.clientCompany}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'clientCompany',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="IMP Name"
                    value={viewRequirement.impName || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'impName',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Client Website"
                    value={viewRequirement.clientWebsite || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'clientWebsite',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="IMP Website"
                    value={viewRequirement.impWebsite || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'impWebsite',
                        value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Vendor Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Vendor Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <EditableField
                    label="Vendor Company"
                    value={viewRequirement.vendorCompany || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'vendorCompany',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Vendor Website"
                    value={viewRequirement.vendorWebsite || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'vendorWebsite',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Vendor Contact Person"
                    value={viewRequirement.vendorPersonName || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'vendorPersonName',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Vendor Phone"
                    value={viewRequirement.vendorPhone || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'vendorPhone',
                        value,
                      })
                    }
                  />

                  <EditableField
                    label="Vendor Email"
                    value={viewRequirement.vendorEmail || ''}
                    onSave={(value) =>
                      updateFieldMutation.mutateAsync({
                        id: viewRequirement.id,
                        field: 'vendorEmail',
                        value,
                      })
                    }
                  />
                </div>
              </div>

              {viewRequirement.nextStep && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">Legacy Next Step</label>
                  <p className="text-slate-600 mt-2 text-xs italic">{viewRequirement.nextStep}</p>
                </div>
              )}

              {/* Next Step Comments Thread */}
              <Suspense fallback={<div className="p-4">Loading comments...</div>}>
                <NextStepComments requirementId={viewRequirement.id} />
              </Suspense>

              <EditableField
                label="Job Description"
                value={viewRequirement.completeJobDescription}
                onSave={(value) =>
                  updateFieldMutation.mutateAsync({
                    id: viewRequirement.id,
                    field: 'completeJobDescription',
                    value,
                  })
                }
                textarea={true}
              />
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setShowAuditLog(true)}>
                <History size={16} className="mr-2" />
                View History
              </Button>
              <div>
                <Button variant="outline" onClick={() => setViewRequirement(null)} className="mr-2">
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setViewRequirement(null);
                    handleEditRequirement(viewRequirement);
                  }}
                >
                  <Edit size={16} className="mr-2" />
                  Edit
                </Button>
              </div>
            </DialogFooter>

            <AuditLogDialog
              isOpen={showAuditLog}
              onClose={() => setShowAuditLog(false)}
              requirementId={viewRequirement.id}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Requirement</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this requirement? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Interview Form */}
      <Suspense fallback={<div className="p-4">Loading interview form...</div>}>
        <InterviewForm
          open={showInterviewForm}
          onClose={() => {
            setShowInterviewForm(false);
            setSelectedRequirementForInterview(null);
          }}
          onSubmit={handleInterviewFormSubmit}
          initialData={selectedRequirementForInterview ? {
            requirementId: selectedRequirementForInterview.id,
            displayRequirementId: selectedRequirementForInterview.displayId || selectedRequirementForInterview.id,
            consultantId: selectedRequirementForInterview.consultantId || '',
            vendorCompany: selectedRequirementForInterview.vendorCompany || '',
            jobDescription: selectedRequirementForInterview.completeJobDescription || '',
          } : undefined}
          isSubmitting={createInterviewMutation.isPending}
        />
      </Suspense>
    </ErrorBoundaryWrapper>
  );
}
