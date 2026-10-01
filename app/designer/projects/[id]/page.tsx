'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import CustomSelect from '../../../../components/ui/CustomSelect';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Portal from '@/components/ui/Portal';
import { StatusBadge, DeadlineBadge, SkeletonProjectDetail } from '@/components/ui';
import { downloadFile } from '@/utils/downloadFile';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DesignerProjectDetail({ params }: PageProps) {
  const { id } = use(params);
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Deliverables' | 'Revisions'>('Overview');

  // Management / Upload states
  const [status, setStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'deliverable_report' | 'deliverable_boq' | 'deliverable_lux' | 'deliverable_layout'>('deliverable_report');

  // Status update prompt modal state after deliverable upload
  const [showStatusPromptModal, setShowStatusPromptModal] = useState(false);

  // Designer revision submit states
  const [designerNotes, setDesignerNotes] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // Confirm delete states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; filePath: string } | null>(null);

  const steps = [
    { name: 'Submitted', statusKey: 'Submitted' },
    { name: 'Under Review', statusKey: 'Under Review' },
    { name: 'In Design', statusKey: 'In Design' },
    { name: 'Ready for Review', statusKey: 'Ready for Client Review' },
    { name: 'Revision Requested', statusKey: 'Revision Requested' },
    { name: 'Approved', statusKey: 'Approved' },
    { name: 'Closed', statusKey: 'Closed' }
  ];

  const getActiveStepIndex = () => {
    if (!status) return 0;
    switch (status) {
      case 'Submitted': return 0;
      case 'Under Review': return 1;
      case 'In Design': return 2;
      case 'Ready for Client Review': return 3;
      case 'Revision Requested': return 4;
      case 'Approved': return 5;
      case 'Closed': return 6;
      default: return 0;
    }
  };
  const activeStepIndex = getActiveStepIndex();

  useEffect(() => {
    if (!id) return;

    async function fetchProjectDetails() {
      try {
        let resData: any = null;
        try {
          const res = await fetch(`/api/designer/projects/${id}`);
          if (res.ok) {
            resData = await res.json();
          }
        } catch (e) { }

        if (!resData || !resData.project) {
          const { data: clientProj } = await supabase
            .from('projects')
            .select('*, pricing_plans(name)')
            .eq('id', id)
            .maybeSingle();

          if (clientProj) {
            const { data: prefData } = await supabase
              .from('project_lighting_preferences')
              .select('preference_name')
              .eq('project_id', id);

            const { data: fileData } = await supabase
              .from('project_files')
              .select('*, profiles:uploaded_by(role)')
              .eq('project_id', id);

            const { data: revData } = await supabase
              .from('revision_requests')
              .select('*')
              .eq('project_id', id)
              .order('created_at', { ascending: false });

            resData = {
              project: clientProj,
              preferences: prefData || [],
              files: fileData || [],
              revisions: revData || []
            };
          }
        }

        if (resData?.project) {
          setProject(resData.project);
          setStatus(resData.project.status);
          setPreferences(resData.preferences || []);
          setFiles(resData.files || []);
          setDeliverables((resData.files || []).filter((f: any) => f.profiles?.role === 'designer' || (f.category && f.category.startsWith('deliverable_'))));
          setRevisions(resData.revisions || []);
        }
      } catch (err: any) {
        console.error('Error fetching designer project detail:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProjectDetails();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    setActionMessage('');
    try {
      let success = false;
      try {
        const res = await fetch('/api/designer/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: id, status: newStatus })
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          success = true;
        }
      } catch (e) { }

      if (!success) {
        // Direct client-side update fallback
        const { error: clientErr } = await supabase
          .from('projects')
          .update({ status: newStatus })
          .eq('id', id);

        if (clientErr) throw clientErr;
      }

      setStatus(newStatus);
      setProject((prev: any) => ({ ...prev, status: newStatus }));
      setActionMessage('Status updated successfully!');
      setTimeout(() => setActionMessage(''), 3500);
    } catch (err: any) {
      console.error('Error updating status:', err);
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSubmitRevisionNotes = async (e: React.FormEvent, revId: string) => {
    e.preventDefault();
    if (!designerNotes.trim()) return;

    setSubmittingRevision(true);
    setActionMessage('');

    try {
      const res = await fetch(`/api/designer/projects/${id}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId: revId, designerNotes: designerNotes.trim() })
      });
      const resData = await res.json();

      if (resData.error) throw new Error(resData.error);

      setRevisions(prev =>
        prev.map(r =>
          r.id === revId
            ? { ...r, description: `${r.description || ''}\n\n=== DESIGNER_RESOLUTION ===\n${designerNotes.trim()}` }
            : r
        )
      );
      setStatus('Ready for Client Review');
      setProject((prev: any) => ({ ...prev, status: 'Ready for Client Review' }));
      setDesignerNotes('');
      setActionMessage('Revision submitted! Project is now Ready for Client Review.');
    } catch (err: any) {
      console.error('Error submitting revision notes:', err);
      setActionMessage(`Error: ${err.message || 'Failed to submit'}`);
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setActionMessage('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', selectedCategory);

      const res = await fetch(`/api/designer/projects/${id}/upload`, {
        method: 'POST',
        body: formData,
      });
      const resData = await res.json();

      if (resData.error) throw new Error(resData.error);

      setDeliverables((prev) => [...prev, resData.fileRecord]);
      setSelectedFile(null);

      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Check if project status is not yet 'Ready for Client Review' to prompt status update modal
      if (status !== 'Ready for Client Review' && status !== 'Approved' && status !== 'Closed') {
        setShowStatusPromptModal(true);
      } else {
        setActionMessage('Deliverable uploaded successfully!');
        setTimeout(() => setActionMessage(''), 3500);
      }

    } catch (err: any) {
      console.error(err);
      setActionMessage(`Upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmMoveToReview = async () => {
    await handleStatusChange('Ready for Client Review');
    setShowStatusPromptModal(false);
    setActionMessage('Deliverable uploaded & project status updated to Ready for Client Review!');
    setTimeout(() => setActionMessage(''), 4000);
  };

  const handleDeclineMoveToReview = () => {
    setShowStatusPromptModal(false);
    setActionMessage('Deliverable uploaded successfully!');
    setTimeout(() => setActionMessage(''), 3500);
  };

  const handleDeleteDeliverable = (fileId: string, filePath: string) => {
    setFileToDelete({ id: fileId, filePath });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    const { id: fileId, filePath } = fileToDelete;
    setActionMessage('');

    try {
      const res = await fetch(`/api/designer/projects/${id}/upload`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId, filePath }),
      });
      const resData = await res.json();

      if (resData.error) throw new Error(resData.error);

      setDeliverables((prev) => prev.filter((d) => d.id !== fileId));
      setActionMessage('Deliverable deleted successfully!');
      setTimeout(() => setActionMessage(''), 3000);
    } catch (err: any) {
      setActionMessage(`Delete error: ${err.message}`);
    } finally {
      setFileToDelete(null);
      setDeleteConfirmOpen(false);
    }
  };

  const getFileIcon = (category: string) => {
    switch (category) {
      case 'deliverable_report': return 'bx bxs-file-pdf text-red-600';
      case 'deliverable_lux': return 'bx bxs-pie-chart-alt-2 text-blue-600';
      case 'deliverable_boq': return 'bx bxs-spreadsheet text-amber-600';
      case 'deliverable_layout': return 'bx bxs-image text-purple-600';
      default: return 'bx bxs-file text-neutral-605';
    }
  };

  const getCategoryLabel = (category: string, role?: string) => {
    if (role && role !== 'designer') {
      switch (category) {
        case 'deliverable_layout': return 'Architectural Layout';
        case 'deliverable_boq': return 'Electrical Grid Map';
        case 'deliverable_lux': return 'Moodboard Reference';
        case 'deliverable_report': return 'Other Reference File';
        default: return 'Asset File';
      }
    }
    switch (category) {
      case 'deliverable_report': return 'Design Report';
      case 'deliverable_lux': return 'Lux Simulation';
      case 'deliverable_boq': return 'BOQ Schedule';
      case 'deliverable_layout': return 'Layout CAD / Image';
      default: return 'Asset File';
    }
  };

  const getDownloadUrl = (filePath: string) => {
    return supabase.storage.from('project-assets').getPublicUrl(filePath).data.publicUrl;
  };

  if (loading) {
    return <SkeletonProjectDetail />;
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-sm text-neutral-450 font-medium bg-white rounded-2xl border border-neutral-200">
        Project not found or you are not authorized to view it.
      </div>
    );
  }

  return (
    <>
      {/* Secondary Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between bg-white border-b border-neutral-200/80 px-6 py-4 gap-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/designer/projects"
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-955 transition-colors flex items-center justify-center flex-shrink-0"
              title="Back to projects"
            >
              <i className="bx bx-chevron-left text-2xl"></i>
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold text-neutral-900 tracking-tight leading-tight">{project.project_name}</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Client: {project.client_name} &bull; Plan: {project.pricing_plans?.name || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Right side: Scaled-down Workflow Progress Stepper */}
        <div className="flex-1 w-full lg:w-auto animate-fade-in">
          <div className="flex items-start justify-start lg:justify-end overflow-x-auto gap-6 px-6">
            {steps.map((step, idx) => {
              const isCompleted = idx < activeStepIndex;
              const isActive = idx === activeStepIndex;
              return (
                <div key={step.name} className="flex-none w-[100px] lg:w-[110px] flex flex-col items-center relative">
                  {/* Connecting Line */}
                  {idx < steps.length - 1 && (
                    <div className={`absolute top-[16px] left-[50%] w-[calc(100%+24px)] h-[2px] z-0 ${idx < activeStepIndex ? 'bg-amber-600' : 'bg-neutral-200'}`} />
                  )}
                  {/* Circle Dot */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-sans text-xs font-semibold relative z-10 transition-all duration-300 ${isActive
                      ? 'bg-amber-600 border-amber-600 text-white ring-4 ring-amber-600/10 shadow-sm shadow-amber-600/10'
                      : isCompleted
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white border-neutral-200 text-neutral-400'
                    }`}>
                    {isCompleted ? <i className="bx bx-check text-xs"></i> : idx + 1}
                  </div>
                  <span className={`text-xs mt-2 font-semibold transition-colors duration-200 text-center relative z-10 leading-tight w-full break-words ${isActive ? 'text-amber-700 font-bold' : isCompleted ? 'text-amber-600' : 'text-neutral-400'
                    }`}>
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Section */}
      <main className="flex-1 overflow-y-auto p-4 bg-neutral-50/70">
        <div className="content-container">



          {/* Action Message Banner */}
          {actionMessage && (
            <div className={`mb-4 p-4 rounded-md text-xs font-semibold border flex items-center space-x-2 animate-fade-in ${actionMessage.startsWith('Error') || actionMessage.includes('error')
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
              <i className={`bx ${actionMessage.startsWith('Error') || actionMessage.includes('error') ? 'bx-error-circle text-base' : 'bx-check-circle text-base'}`}></i>
              <span>{actionMessage}</span>
            </div>
          )}

          {/* Action Needed Revision Alert Banner */}
          {revisions.some((r) => r.status === 'approved' && !r.description?.includes('=== DESIGNER_RESOLUTION ===')) && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start space-x-3.5 animate-pulse-subtle">
              <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                <i className="bx bx-error-alt text-lg"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-amber-900">Action Required: Revision Request Approved</h4>
                <p className="text-xs text-amber-700 font-medium font-sans mt-0.5">
                  The administrator has approved a design revision request. Check details in the{' '}
                  <button
                    onClick={() => setActiveTab('Revisions')}
                    className="text-amber-800 underline font-semibold hover:text-amber-950 ml-1 cursor-pointer"
                  >
                    Revisions Tab
                  </button>, upload updated files in Deliverables, and submit your resolution notes.
                </p>
              </div>
            </div>
          )}

          {/* Full Width Tab Card Container */}
          <div className="w-full space-y-6">
            <div className="bg-white border border-neutral-200 rounded-sm py-6 pt-0 font-sans text-neutral-800">
              {/* Tabs Header */}
              <div className="border-b border-neutral-200 mb-6 bg-white flex items-center justify-between pl-6 pr-3 h-14">
                <div className="flex space-x-8 h-full -mb-px">
                  {['Overview', 'Deliverables', 'Revisions'].map((tab) => {
                    const isCurrent = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab as any)}
                        className={`h-full text-sm font-semibold transition-all relative flex items-center space-x-1.5 border-b-2 cursor-pointer ${isCurrent
                            ? 'text-amber-600 border-amber-600'
                            : 'text-neutral-500 hover:text-neutral-800 border-transparent hover:border-neutral-350'
                          }`}
                      >
                        <span>{tab}</span>
                        {tab === 'Deliverables' && deliverables.length > 0 && (
                          <span className={`ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full ${isCurrent ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'}`}>
                            {deliverables.length}
                          </span>
                        )}
                        {tab === 'Revisions' && revisions.length > 0 && (
                          <span className={`ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full ${isCurrent ? 'bg-rose-100 text-rose-700' : 'bg-neutral-100 text-neutral-600'}`}>
                            {revisions.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Contents */}
              <div>
                {activeTab === 'Overview' && (
                  <div className="space-y-6">
                    {/* 3-column parameter grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4 px-6">
                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Client Name</span>
                        <span className="text-sm font-semibold text-neutral-800 mt-1 block">{project.client_name}</span>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Project Type</span>
                        <span className="text-sm font-semibold text-neutral-800 mt-1 block">{project.project_type || 'N/A'}</span>
                      </div>

                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Site Location</span>
                        <span className="text-sm font-semibold text-neutral-800 mt-1 block">{project.site_location || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Total Area</span>
                        <span className="text-sm font-semibold text-neutral-800 mt-1 block">{project.area_sq_ft ? `${Number(project.area_sq_ft).toLocaleString()} sq.ft.` : 'N/A'}</span>
                      </div>

                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Delivery Timeline</span>
                        <span className="text-sm font-semibold text-neutral-800 mt-1 block">{project.timeline || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Target Deadline</span>
                        <span className="text-sm font-semibold text-neutral-800 mt-1 block">
                          {project.deadline
                            ? new Date(project.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'TBD'}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Uploaded Onboarding Files</span>
                        <span className="text-sm font-semibold text-neutral-800 mt-1 block">
                          {files.filter(f => f.profiles?.role !== 'designer').length} file{files.filter(f => f.profiles?.role !== 'designer').length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Last Updated</span>
                        <span className="text-sm font-semibold text-neutral-800 mt-1 block">
                          {project.updated_at
                            ? new Date(project.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                            : new Date(project.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-neutral-400 font-medium block">Design Status</span>
                        <div className="mt-1.5 block">
                          <StatusBadge status={project.status} showDot size="md" />
                        </div>
                      </div>
                    </div>

                    {/* Lighting Preferences Section */}
                    <div className="pt-6 border-t border-neutral-100 px-6">
                      <span className="text-xs font-bold text-neutral-450 tracking-wide block mb-3">Lighting Preferences</span>
                      {preferences.length === 0 ? (
                        <p className="text-xs text-neutral-400 italic">No specific lighting preferences selected.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {preferences.map((pref) => (
                            <span
                              key={pref.preference_name}
                              className="px-3.5 py-1.5 border border-amber-500/30 text-amber-650 rounded-full text-xs font-semibold bg-transparent"
                            >
                              {pref.preference_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Project Notes */}
                    {project.project_notes && (
                      <div className="pt-6 border-t border-neutral-100 px-6">
                        <span className="text-xs font-bold text-neutral-450 tracking-wide block mb-2">Project Notes</span>
                        <div className="bg-neutral-50/50 border border-neutral-200/80 rounded-md p-4 text-xs text-neutral-600 font-medium leading-relaxed">
                          {project.project_notes}
                        </div>
                      </div>
                    )}

                    {/* Uploaded Onboarding Files */}
                    <div className="pt-6 border-t border-neutral-100 px-6">
                      <span className="text-xs font-bold text-neutral-450 tracking-wide block mb-3">Uploaded Onboarding Files</span>
                      {files.filter(f => f.profiles?.role !== 'designer').length === 0 ? (
                        <p className="text-xs text-neutral-400 italic">No onboarding documents uploaded.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {files.filter(f => f.profiles?.role !== 'designer').map((file) => (
                            <div key={file.id} className="flex justify-between items-center p-3 bg-neutral-50 border border-neutral-200 rounded-sm hover:border-neutral-300 transition-colors">
                              <div className="flex items-center space-x-3 overflow-hidden">
                                <div className="w-9 h-9 bg-white border border-neutral-100 rounded-lg flex items-center justify-center text-neutral-450 flex-shrink-0">
                                  <i className="bx bx-file text-lg"></i>
                                </div>
                                <div className="overflow-hidden min-w-0">
                                  <p className="font-semibold text-neutral-800 text-xs truncate">{file.file_name}</p>
                                  <p className="text-xs text-neutral-400 mt-0.5 font-medium">{file.file_type} &middot; {getCategoryLabel(file.category, file.profiles?.role)}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => downloadFile(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-assets/${file.file_path}`, file.file_name)}
                                className="px-3 py-1.5 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 font-semibold text-xs rounded-sm transition-colors flex-shrink-0 cursor-pointer"
                              >
                                Download
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'Deliverables' && (
                  <div className="space-y-6 px-6">
                    {/* Upload Form Box */}
                    <div className="bg-neutral-50/50 border border-neutral-200 rounded-md p-5 space-y-4">
                      <h4 className="text-xs font-semibold text-neutral-900 flex items-center space-x-1.5">
                        <i className="bx bx-upload text-amber-600 text-base"></i>
                        <span>Upload Design Deliverable Asset</span>
                      </h4>

                      <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                        <div className="sm:col-span-4">
                          <label className="block text-xs font-semibold text-neutral-400 tracking-wide mb-1.5">
                            Deliverable Category
                          </label>
                          <CustomSelect
                            value={selectedCategory}
                            onChange={(val) => setSelectedCategory(val as any)}
                            options={[
                              { value: 'deliverable_report', label: 'Design Report (PDF)' },
                              { value: 'deliverable_lux', label: 'Lux Simulation (PDF)' },
                              { value: 'deliverable_boq', label: 'BOQ Schedule (Excel/PDF)' },
                              { value: 'deliverable_layout', label: 'Layout CAD / Image' }
                            ]}
                            className="w-full text-xs"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <label className="block text-xs font-semibold text-neutral-400 tracking-wide mb-1.5">
                            Choose File
                          </label>
                          <input
                            id="file-input"
                            type="file"
                            required
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="w-full text-xs text-neutral-700 bg-white border border-neutral-200 rounded-md p-1.5 focus:outline-none file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-800 transition-colors disabled:opacity-50"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <button
                            type="submit"
                            disabled={uploading || !selectedFile}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-md transition-colors flex items-center justify-center space-x-1.5 active:scale-[0.98] cursor-pointer"
                          >
                            {uploading ? (
                              <span>Uploading...</span>
                            ) : (
                              <>
                                <i className="bx bx-cloud-upload text-sm"></i>
                                <span>Upload Asset</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Deliverables List */}
                    {deliverables.length === 0 ? (
                      <div className="py-12 text-center text-sm text-neutral-450 font-medium space-y-2 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                        <i className="bx bx-file-blank text-3xl text-neutral-300"></i>
                        <p className="font-medium">No deliverables uploaded yet.</p>
                        <p className="text-xs text-neutral-400">Use the form above to upload layout sheets or calculation reports.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {deliverables.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-xl border-l-4 border-amber-500 transition-all">
                            <div className="flex items-center space-x-3 overflow-hidden">
                              <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
                                <i className={`${getFileIcon(file.category)} text-xl`}></i>
                              </div>
                              <div className="overflow-hidden min-w-0">
                                <p className="font-semibold text-neutral-800 text-sm truncate">{file.file_name}</p>
                                <p className="text-xs text-neutral-405 mt-0.5 font-medium">{getCategoryLabel(file.category, file.profiles?.role)}</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => downloadFile(getDownloadUrl(file.file_path), file.file_name)}
                                className="w-8 h-8 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                                title="Download Deliverable"
                              >
                                <i className="bx bx-download text-sm"></i>
                              </button>
                              <button
                                onClick={() => handleDeleteDeliverable(file.id, file.file_path)}
                                className="w-8 h-8 bg-white hover:bg-rose-50 text-neutral-400 hover:text-rose-600 border border-neutral-200 hover:border-rose-200 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                                title="Delete Deliverable"
                              >
                                <i className="bx bx-trash text-sm"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'Revisions' && (
                  <div className="space-y-4 px-6">
                    {revisions.length === 0 ? (
                      <div className="py-12 text-center text-sm text-neutral-450 font-medium space-y-2 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                        <i className="bx bx-comment-detail text-3xl text-neutral-300"></i>
                        <p className="font-medium">No revision requests filed.</p>
                        <p className="text-xs text-neutral-400">Architect feedback will appear here if revisions are requested.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {revisions.map((rev) => {
                          const [architectRequest, designerNotesPart] = (rev.description || '').split('\n\n=== DESIGNER_RESOLUTION ===\n');
                          const isResolved = !!designerNotesPart;
                          const isApproved = rev.status === 'approved' && !isResolved;

                          return (
                            <div key={rev.id} className="space-y-4 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
                              {/* Header */}
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-neutral-400 font-medium">
                                  Requested: {new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold border ${isApproved
                                    ? 'bg-amber-50 border-amber-100 text-amber-700 animate-pulse-subtle'
                                    : isResolved
                                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                      : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                                  }`}>
                                  {isApproved ? '⚠️ Action Required' : isResolved ? '✓ Resolved' : rev.status}
                                </span>
                              </div>

                              {/* Architect Request details */}
                              <div className="space-y-1">
                                <span className="text-xs font-bold tracking-wide text-neutral-400 block">Architect Instructions</span>
                                <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3 text-sm text-neutral-800 font-medium leading-relaxed whitespace-pre-wrap">
                                  {architectRequest}
                                </div>
                              </div>

                              {/* Resolution notes if completed */}
                              {designerNotesPart ? (
                                <div className="pl-4 border-l-2 border-emerald-500 space-y-1 mt-2">
                                  <span className="text-xs font-bold tracking-wide text-emerald-600 block">Your Resolution Notes</span>
                                  <p className="text-sm text-neutral-700 font-medium leading-relaxed whitespace-pre-wrap">{designerNotesPart}</p>
                                </div>
                              ) : isApproved ? (
                                /* Resolution Form */
                                <form onSubmit={(e) => handleSubmitRevisionNotes(e, rev.id)} className="space-y-3 pt-2">
                                  <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-neutral-700">
                                      Resolution Notes for Architect *
                                    </label>
                                    <textarea
                                      required
                                      rows={3}
                                      value={designerNotes}
                                      onChange={(e) => setDesignerNotes(e.target.value)}
                                      placeholder="Explain what changes were made (e.g., Repositioned track lights, updated lux calculations, uploaded revised PDF)..."
                                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-md text-xs font-medium text-neutral-800 focus:bg-white focus:outline-none focus:border-amber-500 transition-all resize-none"
                                    />
                                  </div>

                                  <button
                                    type="submit"
                                    disabled={submittingRevision || !designerNotes.trim()}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-md transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                                  >
                                    <i className="bx bx-check-circle text-base"></i>
                                    <span>{submittingRevision ? 'Submitting...' : 'Submit Resolution & Update Status'}</span>
                                  </button>
                                </form>
                              ) : (
                                <p className="text-xs text-neutral-400 italic">Awaiting admin review before action can be taken.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Status Update Prompt Modal after Deliverable Upload */}
      {showStatusPromptModal && (
        <Portal>
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
            <div className="bg-white border border-neutral-200 rounded-lg max-w-lg w-full p-7 space-y-6 shadow-xl text-center">

              {/* Top Centered Icon Badge */}
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mx-auto">
                <i className="bx bx-cloud-upload text-3xl"></i>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-neutral-900">Deliverable Uploaded Successfully</h3>
                <p className="text-sm text-neutral-600 font-medium leading-relaxed max-w-md mx-auto">
                  Would you like to update the project status to <span className="font-semibold text-neutral-900">&apos;Ready for Client Review&apos;</span> so the architect and client can inspect the new deliverables?
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDeclineMoveToReview}
                  className="w-full sm:w-auto px-5 py-2.5 border border-neutral-200 hover:bg-neutral-50 bg-white rounded-md text-sm font-semibold text-neutral-700 transition-colors cursor-pointer text-center"
                >
                  Not Now
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMoveToReview}
                  disabled={updatingStatus}
                  className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  {updatingStatus ? (
                    <span>Updating Status...</span>
                  ) : (
                    <>
                      <span>Send for Review</span>
                      <i className="bx bx-paper-plane text-base ml-1"></i>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </Portal>
      )}

      {/* Delete Deliverable Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Deliverable"
        message="Are you sure you want to delete this deliverable asset? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setFileToDelete(null);
        }}
      />
    </>
  );
}
