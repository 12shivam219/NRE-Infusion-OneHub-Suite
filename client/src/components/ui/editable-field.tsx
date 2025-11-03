import React, { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Textarea } from './textarea';
import { Pencil, Check, X } from 'lucide-react';

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
  textarea?: boolean;
  type?: string;
  isNextStep?: boolean;
}

export function EditableField({
  label,
  value,
  onSave,
  textarea = false,
  type = 'text',
  isNextStep = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="group relative">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <div className="mt-1 text-slate-600 relative">
          {textarea ? (
            <div className="whitespace-pre-wrap">{value || 'N/A'}</div>
          ) : (
            <div>{value || 'N/A'}</div>
          )}
          {!isNextStep && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="mt-1 flex items-start gap-2">
        {textarea ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            className="flex-1"
          />
        ) : (
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1"
          />
        )}
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 w-8 p-0"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
