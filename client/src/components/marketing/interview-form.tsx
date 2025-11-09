import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  User,
  Building,
  Video,
  Phone,
  AlertCircle,
  CheckCircle,
  Save,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { InterviewStatus } from '@shared/schema';

// Form interface
interface InterviewFormData {
  requirementId?: string;
  displayRequirementId?: string;  // For displaying the formatted requirement ID
  interviewDate?: string | Date;
  interviewTime?: string;
  timezone: string;
  interviewType?: string;
  status: string;
  consultantId?: string;
  vendorCompany?: string;
  interviewWith?: string;
  result?: string;
  round?: string;
  mode?: string;
  meetingType?: string;
  duration?: string;
  subjectLine?: string;
  interviewer?: string;
  interviewLink?: string;
  interviewFocus?: string;
  specialNote?: string;
  jobDescription?: string;
  feedbackNotes?: string;
}

interface InterviewFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (interviewData: InterviewFormData) => Promise<void>;
  initialData?: Partial<InterviewFormData>;
  editMode?: boolean;
  isSubmitting?: boolean;
}

// FieldWrapper component moved outside to prevent re-creation on every render
const FieldWrapper = ({
  children,
  error,
  status = 'default',
}: {
  children: React.ReactNode;
  error?: string;
  status?: 'default' | 'success' | 'error';
}) => (
  <div className="relative">
    {children}
    {status === 'success' && (
      <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
    )}
    {status === 'error' && <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-red-500" />}
    {error && (
      <p className="text-sm text-red-500 mt-1 flex items-center">
        <AlertCircle className="h-3 w-3 mr-1" />
        {error}
      </p>
    )}
  </div>
);

export default function InterviewForm({
  open,
  onClose,
  onSubmit,
  initialData,
  editMode = false,
  isSubmitting = false,
}: InterviewFormProps) {
  const [activeTab, setActiveTab] = useState('basic');

  // Fetch consultants for assignment
  const { data: consultants = [], isLoading: consultantsLoading } = useQuery({
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
        console.log('Fetched consultants:', data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching consultants:', error);
        return [] as any[];
      }
    },
    retry: 1,
  });

  // Form validation schema with required fields
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
    reset,
    trigger,
  } = useForm<InterviewFormData>({
    resolver: zodResolver(
      z.object({
        requirementId: z.string().min(1, "Requirement is required"),
        displayRequirementId: z.string().optional(),
        interviewDate: z.date().or(z.string().min(1, "Interview date is required")),
        interviewTime: z.string().min(1, "Interview time is required"),
        timezone: z.string().default("EST"),
        interviewType: z.string().optional(),
        status: z.string().default("Confirmed"),
        consultantId: z.string().min(1, "Consultant is required"),
        vendorCompany: z.string().optional(),
        interviewWith: z.string().optional(),
        result: z.string().optional(),
        round: z.string().optional(),
        mode: z.string().optional(),
        meetingType: z.string().optional(),
        duration: z.string().optional(),
        subjectLine: z.string().optional(),
        interviewer: z.string().optional(),
        interviewLink: z.string().optional(),
        interviewFocus: z.string().optional(),
        specialNote: z.string().optional(),
        jobDescription: z.string().optional(),
        feedbackNotes: z.string().optional(),
      }).passthrough()
    ),
    defaultValues: {
      requirementId: '',
      displayRequirementId: '',
      interviewDate: '',
      interviewTime: '',
      timezone: 'EST',
      interviewType: '',
      status: InterviewStatus.CONFIRMED,
      consultantId: '',
      vendorCompany: '',
      interviewWith: 'Client',
      result: '',
      round: '1',
      mode: 'Video',
      meetingType: '',
      duration: '1 hour',
      subjectLine: '',
      interviewer: '',
      interviewLink: '',
      interviewFocus: '',
      specialNote: '',
      jobDescription: '',
      feedbackNotes: '',
    },
    mode: 'onBlur',
  });

  // Effect to handle initialData changes
  useEffect(() => {
    if (open && initialData) {
      console.log('InterviewForm received initialData:', initialData);
      
      // Helper function to safely convert the date string from the API to a Date object
      // const parseDate = (dateString: string | undefined): Date | string => {
      //   if (!dateString) return '';
      //   const dateObj = new Date(dateString);
      //   return isNaN(dateObj.getTime()) ? dateString : dateObj;
      // };

      // Helper to convert date string to Date object only if it exists
      const dateToSet = initialData.interviewDate 
        ? new Date(initialData.interviewDate)
        : '';

      // Reset form with initial data
      reset({
        requirementId: initialData.requirementId || '',
        displayRequirementId: initialData.displayRequirementId || initialData.requirementId || '',
        interviewDate: dateToSet,
        interviewTime: initialData.interviewTime || '',
        timezone: initialData.timezone || 'EST',
        interviewType: initialData.interviewType || '',
        status: (initialData.status as any) || 'Confirmed',
        consultantId: initialData.consultantId || '',
        vendorCompany: initialData.vendorCompany || '',
        interviewWith: initialData.interviewWith || 'Client',
        result: initialData.result || '',
        round: initialData.round || '1',
        mode: initialData.mode || 'Video',
        meetingType: initialData.meetingType || '',
        duration: initialData.duration || '1 hour',
        subjectLine: initialData.subjectLine || '',
        interviewer: initialData.interviewer || '',
        interviewLink: initialData.interviewLink || '',
        interviewFocus: initialData.interviewFocus || '',
        specialNote: initialData.specialNote || '',
        jobDescription: initialData.jobDescription || '',
        feedbackNotes: initialData.feedbackNotes || '',
      });
    }
  }, [open, initialData, reset]);

  // Get field error and status
  const getFieldError = (fieldName: string) => {
    const error = errors[fieldName as keyof typeof errors];
    return error?.message as string | undefined;
  };
  
  const getFieldStatus = (fieldName: string) => {
    const error = errors[fieldName as keyof typeof errors];
    if (error) return 'error' as const;
    return 'default' as const;
  };

  const handleFormSubmit = async (data: InterviewFormData) => {
    try {
      // Validate required fields
      if (!data.requirementId || data.requirementId.trim() === '') {
        toast.error('Please select a requirement');
        return;
      }
      
      if (!data.consultantId || data.consultantId.trim() === '') {
        toast.error('Please select a consultant');
        return;
      }
      
      if (!data.interviewDate) {
        toast.error('Please select an interview date');
        return;
      }
      
      if (!data.interviewTime || data.interviewTime.trim() === '') {
        toast.error('Please enter an interview time');
        return;
      }

      // Ensure interviewDate is a proper Date object
      if (data.interviewDate) {
        let date: Date;
        if (typeof data.interviewDate === 'string') {
          date = new Date(data.interviewDate);
        } else {
          date = data.interviewDate as Date;
        }
        
        if (!isNaN(date.getTime())) {
          data.interviewDate = date as any;
        } else {
          throw new Error('Invalid interview date format');
        }
      }

      console.log('Form data being submitted:', data);
      await onSubmit(data);


      reset();
    } catch (error: any) {
      // Error handling is done in the parent component
      console.error('Form submission error:', error);
    }
  };

  // Auto-generate subject line based on form data
  const generateSubjectLine = () => {
    const formValues = watch();
    const subjectLine = `Interview - Requirement ${formValues.requirementId} - Round ${formValues.round} - ${
      formValues.interviewDate
        ? new Date(formValues.interviewDate).toLocaleDateString()
        : '[Date]'
    }`;
    setValue('subjectLine', subjectLine);
    toast.success('Subject line generated');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center space-x-2">
                <Calendar size={20} />
                <span>{editMode ? 'Edit Interview' : 'Schedule New Interview'}</span>
              </DialogTitle>
              <DialogDescription>
                Fill out the form to schedule a comprehensive interview
              </DialogDescription>
            </div>
            <Badge variant={isValid ? 'default' : 'secondary'}>
              {isValid ? 'Valid' : 'Incomplete'}
            </Badge>
          </div>
        </DialogHeader>

        <form
          id="interview-form"
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex-1 overflow-y-auto"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="flex items-center space-x-2">
                <Calendar size={16} />
                <span>Basic Info</span>
                {errors.requirementId || errors.interviewDate || errors.interviewTime ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center space-x-2">
                <User size={16} />
                <span>Interview Details</span>
                {errors.interviewer || errors.vendorCompany ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="additional" className="flex items-center space-x-2">
                <Building size={16} />
                <span>Additional Info</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Interview Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="requirementId">Requirement ID</Label>
                      <FieldWrapper
                        error={getFieldError('requirementId')}
                        status={getFieldStatus('requirementId')}
                      >
                        <Controller
                          name="requirementId"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              readOnly
                              value={watch('displayRequirementId') || field.value || ''}
                              className="bg-gray-50"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="consultantId">Assigned Consultant *</Label>
                      <FieldWrapper error={getFieldError('consultantId')}>
                        <Controller
                          name="consultantId"
                          control={control}
                          render={({ field }) => {
                            // Show read-only field if consultant is pre-assigned from requirement
                            if (initialData?.consultantId && field.value) {
                              if (consultantsLoading) {
                                return (
                                  <Input
                                    readOnly
                                    value="Loading consultant..."
                                    className="bg-gray-50"
                                  />
                                );
                              }
                              
                              const consultant = consultants.find((c: any) => c.id === field.value);
                              const consultantName = consultant ? `${consultant.name} (${consultant.email})` : 'Consultant not found';
                              return (
                                <Input
                                  readOnly
                                  value={consultantName}
                                  className="bg-gray-50"
                                />
                              );
                            }
                            
                            // Show dropdown for manual selection
                            return (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || ''}
                              >
                                <SelectTrigger className={errors.consultantId ? 'border-red-500' : ''}>
                                  <SelectValue placeholder="Select consultant" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Array.isArray(consultants) ? consultants : [])
                                    .filter((c: any) => c?.status === 'Active')
                                    .map((consultant: any) => (
                                      <SelectItem key={consultant?.id} value={consultant?.id}>
                                        {consultant?.name} ({consultant?.email})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="interviewDate">Interview Date *</Label>
                      <FieldWrapper
                        error={getFieldError('interviewDate')}
                        status={getFieldStatus('interviewDate')}
                      >
                        <Controller
                          name="interviewDate"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              type="date"
                              value={
                                field.value ? new Date(field.value).toISOString().split('T')[0] : ''
                              }
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                              className={errors.interviewDate ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="interviewTime">Interview Time *</Label>
                      <FieldWrapper
                        error={getFieldError('interviewTime')}
                        status={getFieldStatus('interviewTime')}
                      >
                        <Controller
                          name="interviewTime"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="e.g., 10:30 AM"
                              className={errors.interviewTime ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="timezone">Timezone *</Label>
                      <FieldWrapper error={getFieldError('timezone')}>
                        <Controller
                          name="timezone"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="EST">Eastern (EST)</SelectItem>
                                <SelectItem value="CST">Central (CST)</SelectItem>
                                <SelectItem value="MST">Mountain (MST)</SelectItem>
                                <SelectItem value="PST">Pacific (PST)</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="status">Status *</Label>
                      <FieldWrapper error={getFieldError('status')}>
                        <Controller
                          name="status"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(InterviewStatus).map(([key, value]) => (
                                  <SelectItem key={key} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Interview Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vendorCompany">Vendor Company *</Label>
                      <FieldWrapper
                        error={getFieldError('vendorCompany')}
                        status={getFieldStatus('vendorCompany')}
                      >
                        <Controller
                          name="vendorCompany"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="Company conducting interview"
                              className={errors.vendorCompany ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="interviewer">Interviewer *</Label>
                      <FieldWrapper
                        error={getFieldError('interviewer')}
                        status={getFieldStatus('interviewer')}
                      >
                        <Controller
                          name="interviewer"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="Name of the interviewer"
                              className={errors.interviewer ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="interviewWith">Interview With *</Label>
                      <FieldWrapper error={getFieldError('interviewWith')}>
                        <Controller
                          name="interviewWith"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Client">Client</SelectItem>
                                <SelectItem value="IMP">IMP</SelectItem>
                                <SelectItem value="Vendor">Vendor</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="round">Round *</Label>
                      <FieldWrapper error={getFieldError('round')}>
                        <Controller
                          name="round"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Round 1</SelectItem>
                                <SelectItem value="2">Round 2</SelectItem>
                                <SelectItem value="3">Round 3</SelectItem>
                                <SelectItem value="Final">Final Round</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="mode">Mode *</Label>
                      <FieldWrapper error={getFieldError('mode')}>
                        <Controller
                          name="mode"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Phone">
                                  <div className="flex items-center space-x-2">
                                    <Phone size={16} />
                                    <span>Phone</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Video">
                                  <div className="flex items-center space-x-2">
                                    <Video size={16} />
                                    <span>Video</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Video+Coding">
                                  <div className="flex items-center space-x-2">
                                    <Video size={16} />
                                    <span>Video + Coding</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="duration">Duration *</Label>
                      <FieldWrapper
                        error={getFieldError('duration')}
                        status={getFieldStatus('duration')}
                      >
                        <Controller
                          name="duration"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="e.g., 1 hour, 30 mins"
                              className={errors.duration ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="interviewLink">Interview Link</Label>
                      <FieldWrapper
                        error={getFieldError('interviewLink')}
                        status={getFieldStatus('interviewLink')}
                      >
                        <Controller
                          name="interviewLink"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="https://zoom.us/j/123456789 or meeting details"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="subjectLine">Subject Line</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateSubjectLine}
                        >
                          Auto-Generate
                        </Button>
                      </div>
                      <Controller
                        name="subjectLine"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Interview subject line"
                          />
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="additional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="interviewType">Interview Type</Label>
                      <Controller
                        name="interviewType"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="e.g., Technical, HR, Managerial"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="meetingType">Meeting Type</Label>
                      <Controller
                        name="meetingType"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="e.g., Zoom, Teams, Phone Call"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="result">Result</Label>
                      <Controller
                        name="result"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select result" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="Offer">Offer</SelectItem>
                              <SelectItem value="Positive">Positive</SelectItem>
                              <SelectItem value="Negative">Negative</SelectItem>
                              <SelectItem value="No feedback">No feedback</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="interviewFocus">Interview Focus</Label>
                      <Controller
                        name="interviewFocus"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="e.g., React, Node.js, System Design"
                          />
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="specialNote">Special Notes</Label>
                      <Controller
                        name="specialNote"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Any special instructions or notes for the interview..."
                            rows={3}
                          />
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="jobDescription">Job Description</Label>
                      <Controller
                        name="jobDescription"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Job description for the interview (auto-filled from requirement)..."
                            rows={4}
                          />
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="feedbackNotes">Feedback Notes</Label>
                      <Controller
                        name="feedbackNotes"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Interview feedback and notes..."
                            rows={4}
                          />
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>

        <DialogFooter className="flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
              Reset Form
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="interview-form" disabled={isSubmitting || !isValid || Object.keys(errors).length > 0}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting
                ? 'Scheduling...'
                : editMode
                ? 'Update Interview'
                : 'Schedule Interview'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
