'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CustomSelect from '../../../../components/ui/CustomSelect';
import { StatusBadge, PaymentBadge, DeadlineBadge, useToast, ConfirmModal, SkeletonProjectDetail } from '@/components/ui';
import Modal from '@/components/ui/Modal';
import { downloadFile } from '@/utils/downloadFile';

export default function AdminProjectDetail() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Deliverables' | 'Revisions' | 'Activity'>('Overview');
  const [architects, setArchitects] = useState<any[]>([]);
  const [designers, setDesigners] = useState<any[]>([]);

  // Form states
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [architectId, setArchitectId] = useState('');
  const [assignedDesignerId, setAssignedDesignerId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

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
        // 1. Fetch project primary details
        const { data: proj, error: projError } = await supabase
          .from('projects')
          .select('*, pricing_plans(name)')
          .eq('id', id)
          .single();

        if (projError) throw projError;
        setProject(proj);
        setStatus(proj.status);
        setPaymentStatus(proj.payment_status || 'pending');
        setArchitectId(proj.architect_id || '');
        setAssignedDesignerId(proj.assigned_designer_id || '');
        setDeadline(proj.deadline ? new Date(proj.deadline).toISOString().substring(0, 10) : '');

        // 2. Fetch lighting preferences
        const { data: prefs } = await supabase
          .from('project_lighting_preferences')
          .select('preference_name')
          .eq('project_id', id);
        setPreferences(prefs || []);

        // 4. Fetch uploaded files
        const { data: filesData } = await supabase
          .from('project_files')
          .select('*, profiles:uploaded_by(role)')
          .eq('project_id', id);
        setFiles(filesData || []);

        if (filesData) {
          setDeliverables(filesData.filter((f: any) => f.category === 'deliverable' || f.profiles?.role === 'designer'));
        }

        // Fetch revision requests
        const { data: revs } = await supabase
          .from('revision_requests')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false });
        setRevisions(revs || []);

        // 5. Fetch architects
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, role')
          .eq('role', 'architect');
        setArchitects(profiles || []);

        // 6. Fetch designers
        let desList: any[] = [];
        try {
          const uRes = await fetch('/api/admin/users');
          if (uRes.ok) {
            const uData = await uRes.json();
            desList = (uData.users || []).filter((u: any) => u.role !== 'architect');
          }
        } catch (e) { }

        if (desList.length === 0) {
          const { data: designerProfiles } = await supabase
            .from('profiles')
            .select('id, name, role')
            .neq('role', 'architect');
          desList = designerProfiles || [];
        }

        setDesigners(desList);

      } catch (err) {
        console.error('Error fetching project detail:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProjectDetails();
  }, [id]);

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSaveConfirm(true);
  };

  const getSaveChangesSummary = () => {
    const changes: string[] = [];
    if (project?.status !== status) changes.push(`status to "${status}"`);
    if ((project?.payment_status || 'pending') !== paymentStatus) changes.push(`payment status to "${paymentStatus}"`);
    if ((project?.assigned_designer_id || '') !== assignedDesignerId) {
      const designerName = designers.find(d => d.id === assignedDesignerId)?.name;
      changes.push(assignedDesignerId ? `assign designer "${designerName || assignedDesignerId}"` : 'unassign designer');
    }
    const currentDeadline = project?.deadline ? new Date(project.deadline).toISOString().substring(0, 10) : '';
    if (currentDeadline !== deadline) changes.push(deadline ? `deadline to ${deadline}` : 'clear deadline');

    if (changes.length === 0) return 'No fields have changed. Save anyway?';
    return `Update project: ${changes.join(', ')}.`;
  };

  const handleCancelSave = () => {
    setShowSaveConfirm(false);
    if (project) {
      setStatus(project.status || '');
      setPaymentStatus(project.payment_status || 'pending');
      setArchitectId(project.architect_id || '');
      setAssignedDesignerId(project.assigned_designer_id || '');
      setDeadline(project.deadline ? new Date(project.deadline).toISOString().substring(0, 10) : '');
    }
  };

  const performSaveChanges = async () => {
    setUpdating(true);

    try {
      // 1. Update project details via Service Role API
      try {
        await fetch('/api/admin/projects/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: id,
            designerId: assignedDesignerId || null,
            status: status
          })
        });
      } catch (e) {
        console.warn('API update failed, falling back:', e);
      }

      const { error } = await supabase
        .from('projects')
        .update({
          status: status,
          architect_id: architectId || null,
          assigned_designer_id: assignedDesignerId || null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          payment_status: paymentStatus,
        })
        .eq('id', id);

      if (error) throw error;

      // 2. Update payments table status
      await supabase
        .from('payments')
        .update({
          status: paymentStatus === 'paid' ? 'completed' : 'pending',
          transaction_id: paymentStatus === 'paid' ? `manual_${Date.now()}` : null,
        })
        .eq('project_id', id);

      toastSuccess('Changes saved successfully!');

      // Update local project object
      setProject((prev: any) => ({
        ...prev,
        status,
        payment_status: paymentStatus,
        architect_id: architectId || null,
        assigned_designer_id: assignedDesignerId || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      }));
    } catch (err: any) {
      toastError(`Error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!assignedDesignerId) {
      toastError('Please select and assign a designer before approving the project.');
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch('/api/admin/projects/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          designerId: assignedDesignerId,
          status: 'In Design'
        })
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        const { error } = await supabase
          .from('projects')
          .update({
            status: 'In Design',
            assigned_designer_id: assignedDesignerId
          })
          .eq('id', id);
        if (error) throw error;
      }

      setStatus('In Design');
      setProject((prev: any) => ({
        ...prev,
        status: 'In Design',
        assigned_designer_id: assignedDesignerId
      }));
      toastSuccess('Project approved and moved to In Design status!');
    } catch (err: any) {
      toastError('Error: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          status: 'Revision Requested',
          project_notes: `Rejection Reason: ${rejectReason}`
        })
        .eq('id', id);

      if (error) throw error;

      setStatus('Revision Requested');
      setProject((prev: any) => ({
        ...prev,
        status: 'Revision Requested',
        project_notes: `Rejection Reason: ${rejectReason}`
      }));
      toastSuccess('Revision requested successfully!');
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err: any) {
      toastError('Error: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleApproveRevision = async (revId: string) => {
    setUpdating(true);
    try {
      const { error: revErr } = await supabase
        .from('revision_requests')
        .update({ status: 'approved' })
        .eq('id', revId);
      if (revErr) throw revErr;

      const { error: projErr } = await supabase
        .from('projects')
        .update({ status: 'In Design' })
        .eq('id', id);
      if (projErr) throw projErr;

      setStatus('In Design');
      setProject((prev: any) => ({ ...prev, status: 'In Design' }));
      setRevisions(prev => prev.map((r: any) => r.id === revId ? { ...r, status: 'approved' } : r));
      toastSuccess('Revision approved — designer has been notified to work on changes.');
    } catch (err: any) {
      toastError('Error: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeclineRevision = async (revId: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('revision_requests')
        .update({ status: 'declined' })
        .eq('id', revId);
      if (error) throw error;

      setRevisions(prev => prev.map((r: any) => r.id === revId ? { ...r, status: 'declined' } : r));
      toastSuccess('Revision request declined.');
    } catch (err: any) {
      toastError('Error: ' + err.message);
    } finally {
      setUpdating(false);
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
        Project not found.
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
              href="/admin/projects"
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-955 transition-colors flex items-center justify-center flex-shrink-0"
              title="Back to project directory"
            >
              <i className="bx bx-chevron-left text-2xl"></i>
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold text-neutral-900 tracking-tight leading-tight">{project.project_name}</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {project.project_id_serial || 'KL-XXXX'} &bull; Client: {project.client_name} &bull; Plan: {project.pricing_plans?.name || 'N/A'}
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

          {/* Admin Approval Needed Action Banner */}
          {status === 'Submitted' && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse-subtle">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center flex-shrink-0">
                  <i className="bx bx-error text-xl"></i>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">Project Approval Required</h4>
                  <p className="text-xs text-neutral-600 font-medium mt-0.5">
                    This project was submitted by the architect. Please assign an internal designer below and approve the project creation.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-3.5 py-2 border border-rose-300 text-rose-700 bg-white hover:bg-rose-100/50 rounded-md text-xs font-bold transition-all cursor-pointer"
                >
                  Reject Project
                </button>
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-md transition-all cursor-pointer shadow-sm"
                >
                  Approve & Assign
                </button>
              </div>
            </div>
          )}

          {/* Grid Split: Left 8 cols for main tab card, Right 4 cols for sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Left Column: Tab Container Card */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-neutral-200 rounded-sm py-6 pt-0 font-sans text-neutral-800">
                {/* Tabs Menu */}
                <div className="border-b border-neutral-200 mb-6 bg-white flex items-center justify-between pl-6 pr-3 h-14">
                  <div className="flex space-x-8 h-full -mb-px">
                    {['Overview', 'Deliverables', 'Revisions', 'Activity'].map((tab) => {
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
                            <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${isCurrent ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'}`}>
                              {deliverables.length}
                            </span>
                          )}
                          {tab === 'Revisions' && revisions.length > 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${isCurrent ? 'bg-rose-100 text-rose-700' : 'bg-neutral-100 text-neutral-600'}`}>
                              {revisions.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab content */}
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
                          <span className="text-xs text-neutral-400 font-medium block">Fixture Budget Range</span>
                          <span className="text-sm font-semibold text-neutral-800 mt-1 block">{project.budget_range || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-neutral-400 font-medium block">Delivery Timeline</span>
                          <span className="text-sm font-semibold text-neutral-800 mt-1 block">{project.timeline || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-neutral-400 font-medium block">Project Value</span>
                          <span className="text-sm font-semibold text-neutral-800 mt-1 block">
                            {project.calculated_price ? `₹${Number(project.calculated_price).toLocaleString('en-IN')}` : 'N/A'}
                          </span>
                        </div>

                        <div>
                          <span className="text-xs text-neutral-400 font-medium block">Architect</span>
                          <div className="mt-1 block">
                            {architects.find(a => a.id === architectId)?.name ? (
                              <span className="text-sm font-semibold text-neutral-800">
                                {architects.find(a => a.id === architectId)?.name}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-neutral-450">Unassigned</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-neutral-400 font-medium block">Assigned Designer</span>
                          <span className="text-sm font-semibold text-neutral-800 mt-1 block">
                            {designers.find(d => d.id === assignedDesignerId)?.name || 'Unassigned'}
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
                          <span className="text-xs text-neutral-400 font-medium block">Project Status</span>
                          <div className="mt-1.5 block">
                            <StatusBadge status={project.status} showDot size="md" />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-neutral-400 font-medium block">Payment Status</span>
                          <div className="mt-1.5 block">
                            <PaymentBadge status={project.payment_status} size="md" />
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
                    <div className="space-y-4 px-6">
                      {deliverables.length === 0 ? (
                        <div className="py-12 text-center text-sm text-neutral-450 font-medium space-y-2 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                          <i className="bx bx-file-blank text-3xl text-neutral-300"></i>
                          <p className="font-medium">No design deliverables uploaded yet.</p>
                          <p className="text-xs text-neutral-400">Deliverables uploaded by the assigned designer will appear here.</p>
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
                              <button
                                type="button"
                                onClick={() => downloadFile(getDownloadUrl(file.file_path), file.file_name)}
                                className="w-8 h-8 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors flex-shrink-0 cursor-pointer"
                                title="Download Deliverable"
                              >
                                <i className="bx bx-download text-sm"></i>
                              </button>
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
                          <p className="font-medium">No revision requests found.</p>
                          <p className="text-xs text-neutral-400">Architect revision requests will be displayed here for review.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {revisions.map((rev) => {
                            const [architectRequest, designerNotesPart] = (rev.description || '').split('\n\n=== DESIGNER_RESOLUTION ===\n');
                            const isResolved = !!designerNotesPart;
                            const isPending = rev.status === 'pending';

                            return (
                              <div key={rev.id} className="space-y-4 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
                                {/* Header */}
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-neutral-400 font-medium">
                                    Requested: {new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold border ${isPending
                                      ? 'bg-amber-50 border-amber-100 text-amber-700'
                                      : rev.status === 'approved'
                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                        : rev.status === 'declined'
                                          ? 'bg-rose-50 border-rose-100 text-rose-700'
                                          : 'bg-blue-50 border-blue-100 text-blue-700'
                                    }`}>
                                    {isPending ? 'Pending Admin Review' : rev.status === 'approved' ? 'Approved' : rev.status === 'declined' ? 'Declined' : '✓ Resolved'}
                                  </span>
                                </div>

                                {/* Architect Request details */}
                                <div className="space-y-1">
                                  <span className="text-xs font-bold tracking-wide text-neutral-400 block">Architect Instructions</span>
                                  <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3 text-sm text-neutral-800 font-medium leading-relaxed whitespace-pre-wrap">
                                    {architectRequest}
                                  </div>
                                </div>

                                {/* Designer notes if completed */}
                                {designerNotesPart && (
                                  <div className="pl-4 border-l-2 border-emerald-500 space-y-1 mt-2">
                                    <span className="text-xs font-bold tracking-wide text-emerald-600 block">Designer Resolution Notes</span>
                                    <p className="text-sm text-neutral-700 font-medium leading-relaxed whitespace-pre-wrap">{designerNotesPart}</p>
                                  </div>
                                )}

                                {/* Admin Actions for Pending Revisions */}
                                {isPending && (
                                  <div className="flex justify-end space-x-2 pt-2">
                                    <button
                                      onClick={() => handleDeclineRevision(rev.id)}
                                      disabled={updating}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      Decline Request
                                    </button>
                                    <button
                                      onClick={() => handleApproveRevision(rev.id)}
                                      disabled={updating}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      Approve Revision
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Activity' && (
                    <div className="px-6 space-y-4 font-sans">
                      <span className="text-xs font-bold text-neutral-450 uppercase tracking-wider block">Project Lifecycle Audit Timeline</span>

                      {(() => {
                        const events: { id: string; date: string; title: string; desc: string; icon: string; color: string }[] = [];

                        if (project?.created_at) {
                          events.push({
                            id: 'create',
                            date: project.created_at,
                            title: 'Project Onboarded',
                            desc: `Project created by architect ${project.client_name ? `for client ${project.client_name}` : ''}`,
                            icon: 'bx-folder-plus',
                            color: 'bg-amber-50 text-amber-600 border-amber-200'
                          });
                        }

                        files.forEach((f: any) => {
                          events.push({
                            id: f.id,
                            date: f.created_at || project.created_at,
                            title: `File Uploaded: ${f.file_name}`,
                            desc: `Category: ${getCategoryLabel(f.category, f.profiles?.role)}`,
                            icon: 'bx-file',
                            color: 'bg-blue-50 text-blue-600 border-blue-200'
                          });
                        });

                        deliverables.forEach((d: any) => {
                          events.push({
                            id: d.id,
                            date: d.created_at || project.updated_at || project.created_at,
                            title: `Deliverable Uploaded: ${d.file_name}`,
                            desc: `Uploaded by designer (${d.file_type || 'Asset'})`,
                            icon: 'bx-layer',
                            color: 'bg-indigo-50 text-indigo-600 border-indigo-200'
                          });
                        });

                        revisions.forEach((r: any) => {
                          events.push({
                            id: r.id,
                            date: r.created_at || project.created_at,
                            title: `Revision Request: ${r.status?.toUpperCase()}`,
                            desc: r.description,
                            icon: 'bx-git-repo-forked',
                            color: r.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
                          });
                        });

                        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                        return events.length === 0 ? (
                          <p className="text-xs text-neutral-400 italic">No activity recorded yet.</p>
                        ) : (
                          <div className="relative border-l border-neutral-200 ml-3 pl-6 space-y-6">
                            {events.map((ev) => (
                              <div key={ev.id} className="relative">
                                <div className={`absolute -left-[37px] top-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs ${ev.color}`}>
                                  <i className={`bx ${ev.icon}`} />
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-neutral-900">{ev.title}</h4>
                                    <span className="text-[10px] text-neutral-400 font-mono">
                                      {new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-600 leading-relaxed font-medium whitespace-pre-line">{ev.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Admin Management Sidebar Card */}
            <div className="lg:col-span-4 space-y-6">
              <form onSubmit={handleSaveChanges} className="bg-white border border-neutral-200 rounded-md p-6 space-y-6 sticky top-4">
                <div className="flex items-center space-x-2 border-b border-neutral-100 pb-3">
                  <i className="bx bx-slider-alt text-amber-600 text-base"></i>
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Project Settings & Controls
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 tracking-wide mb-1.5">
                      Workflow Status
                    </label>
                    <CustomSelect
                      value={status}
                      onChange={setStatus}
                      options={[
                        { value: 'Submitted', label: 'Submitted' },
                        { value: 'Under Review', label: 'Under Review' },
                        { value: 'In Design', label: 'In Design' },
                        { value: 'Ready for Client Review', label: 'Ready for Client Review' },
                        { value: 'Revision Requested', label: 'Revision Requested' },
                        { value: 'Approved', label: 'Approved' },
                        { value: 'Closed', label: 'Closed' }
                      ]}
                      className="w-full text-xs"
                    />
                  </div>

                  {/* Payment Status */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 tracking-wide mb-1.5">
                      Payment Status
                    </label>
                    <CustomSelect
                      value={paymentStatus}
                      onChange={setPaymentStatus}
                      options={[
                        { value: 'pending', label: 'Payment Pending' },
                        { value: 'paid', label: 'Paid' },
                        { value: 'failed', label: 'Failed' }
                      ]}
                      className="w-full text-xs"
                    />
                  </div>

                  {/* Assign Designer */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 tracking-wide mb-1.5">
                      Assign Workspace Designer
                    </label>
                    <CustomSelect
                      value={assignedDesignerId}
                      onChange={setAssignedDesignerId}
                      options={[
                        { value: '', label: '-- Select Designer --' },
                        ...designers.map(d => ({ value: d.id, label: d.name }))
                      ]}
                      className="w-full text-xs"
                    />
                  </div>

                  {/* Deadline */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 tracking-wide mb-1.5">
                      Target Completion Deadline
                    </label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-xs font-medium text-neutral-800 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div className="pt-3 border-t border-neutral-100">
                    <button
                      type="submit"
                      disabled={updating}
                      className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      {updating ? (
                        <span>Saving Updates...</span>
                      ) : (
                        <>
                          <i className="bx bx-save text-sm"></i>
                          <span>Save Settings</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

          </div>
        </div>
      </main>

      {/* Reject Project Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason(''); }}
        maxWidthClassName="max-w-md"
        labelledBy="reject-modal-title"
      >
          <div className="p-6 space-y-4 font-sans">
              <div>
                <h3 id="reject-modal-title" className="text-base font-semibold text-neutral-900">Request Changes from Architect</h3>
                <p className="text-xs text-neutral-500 mt-1">Provide feedback on why this submission needs modification.</p>
              </div>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">Rejection Reason <span className="text-rose-500">*</span></label>
                    <span className={`text-xs font-sans ${rejectReason.length < 20 ? 'text-neutral-400' : 'text-emerald-600'}`}>
                      {rejectReason.length}/500
                    </span>
                  </div>
                  <textarea
                    required
                    minLength={20}
                    maxLength={500}
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Please specify room height dimensions and attach clear floorplan drawings..."
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-xs font-medium focus:outline-none focus:bg-white focus:border-rose-500 transition-colors resize-none"
                    aria-describedby="reject-reason-hint"
                  />
                  <p id="reject-reason-hint" className="text-xs text-neutral-400 mt-1">Minimum 20 characters.</p>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason('');
                    }}
                    className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 rounded-md text-xs font-semibold text-neutral-600 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || rejectReason.trim().length < 20}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {updating ? 'Submitting...' : 'Submit Rejection'}
                  </button>
                </div>
              </form>
          </div>
      </Modal>

      {/* Save Settings Confirmation */}
      <ConfirmModal
        isOpen={showSaveConfirm}
        title="Confirm Project Update"
        message={getSaveChangesSummary()}
        confirmLabel="Save Changes"
        cancelLabel="Cancel"
        variant="default"
        loading={updating}
        onConfirm={performSaveChanges}
        onClose={handleCancelSave}
      />
    </>
  );
}
