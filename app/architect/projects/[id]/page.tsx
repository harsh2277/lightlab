'use client';

import { useState, useEffect, use, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge, PaymentBadge, DeadlineBadge, useToast, SkeletonProjectDetail } from '@/components/ui';
import Modal from '@/components/ui/Modal';
import { downloadFile } from '@/utils/downloadFile';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ArchitectProjectDetail({ params }: PageProps) {
  const { id } = use(params);
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Deliverables' | 'Revisions' | 'Activity'>('Overview');

  const [designer, setDesigner] = useState<any | null>(null);
  const [payment, setPayment] = useState<any | null>(null);
  const [paymentList, setPaymentList] = useState<any[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPaymentGateModal, setShowPaymentGateModal] = useState(false);

  const copyClientLink = async () => {
    let url = `${window.location.origin}/client/project/${id}`;
    try {
      const res = await fetch(`/api/client/link?projectId=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          url = `${window.location.origin}/client/project/${id}?token=${data.token}`;
        }
      }
    } catch (e) {
      console.warn('Could not generate client link with token:', e);
    }
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

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
    if (!project) return 0;
    switch (project.status) {
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

  const fetchedRef = useRef(false);

  useEffect(() => {
    // Dynamic load Razorpay checkout script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    if (!id) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchDetails() {
      try {
        // Fetch current user details for Razorpay prefill
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user || (await supabase.auth.getUser()).data?.user;
        if (user) {
          const { data: userProf } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', user.id)
            .maybeSingle();
          if (userProf) {
            setUserProfile(userProf);
          }
        }

        // Fetch project
        const { data: proj, error: projError } = await supabase
          .from('projects')
          .select('*, pricing_plans(name)')
          .eq('id', id)
          .single();

        if (projError) throw projError;
        setProject(proj);

        // Fetch designer name if assigned
        if (proj.assigned_designer_id) {
          const { data: des } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', proj.assigned_designer_id)
            .single();
          setDesigner(des);
        } else {
          setDesigner(null);
        }

        // Fetch payment records
        const { data: payList } = await supabase
          .from('payments')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: true });

        const pays = payList || [];
        setPaymentList(pays);
        setPayment(pays[0] || null);

        // Fetch lighting preferences
        const { data: prefs } = await supabase
          .from('project_lighting_preferences')
          .select('preference_name')
          .eq('project_id', id);
        setPreferences(prefs || []);

        // Fetch uploaded files
        const { data: filesData } = await supabase
          .from('project_files')
          .select('*, profiles:uploaded_by(role)')
          .eq('project_id', id);
        setFiles(filesData || []);

        // Filter out design deliverables
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

      } catch (err) {
        console.error('Error fetching project detail details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();

    return () => {
      document.body.removeChild(script);
    };
  }, [id]);

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

  const handleMockPayment = async () => {
    if (typeof (window as any).Razorpay === 'undefined') {
      toast.error('Razorpay SDK is loading, please wait a moment.');
      return;
    }

    const baseAmount = Number(project?.calculated_price || payment?.amount || 0);
    if (baseAmount <= 0) {
      toast.error('This project has no price recorded yet. Please contact your admin before paying.');
      return;
    }
    if (!payment?.id) {
      toast.error('No pending payment record found for this project. Please contact your admin.');
      return;
    }

    setIsProcessingPayment(true);
    const grandTotal = Math.round(baseAmount * 1.18);

    let orderId: string;
    let keyId: string;
    try {
      const orderRes = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, paymentId: payment.id }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to initialize payment');
      orderId = orderData.orderId;
      keyId = orderData.keyId;
    } catch (err) {
      console.error('Error creating payment order:', err);
      setIsProcessingPayment(false);
      return;
    }

    const logoUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/new-logo.png`
      : '/new-logo.png';

    const options = {
      key: keyId,
      order_id: orderId,
      amount: grandTotal * 100, // Amount in paise (Grand Total including 18% GST)
      currency: "INR",
      name: "Lightmaps",
      description: `Payment for ${project?.project_name || 'Project'} (incl. 18% GST)`,
      image: logoUrl,
      handler: async function (response: any) {
        try {
          const verifyRes = await fetch('/api/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: id,
              paymentId: payment?.id,
              kind: 'full',
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.error || 'Payment verification failed');
          }

          // Update local states
          setProject((prev: any) => ({
            ...prev,
            payment_status: 'paid',
            status: 'Under Review'
          }));
          setPayment((prev: any) => ({
            ...prev,
            status: 'completed',
            amount: grandTotal,
            transaction_id: response.razorpay_payment_id
          }));
          setCheckoutOpen(false);
          router.push(`/architect/payments/success?project_id=${id}&amount=${grandTotal}&transaction_id=${response.razorpay_payment_id}`);
        } catch (err) {
          console.error('Payment callback error:', err);
          router.push(`/architect/payments/failed?project_id=${id}&amount=${grandTotal}`);
        } finally {
          setIsProcessingPayment(false);
        }
      },
      prefill: {
        name: userProfile?.name || "",
        email: userProfile?.email || "",
      },
      theme: {
        color: "#F59E0B"
      },
      modal: {
        ondismiss: function () {
          setIsProcessingPayment(false);
          router.push(`/architect/payments/failed?project_id=${id}&amount=${grandTotal}`);
        }
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  const handlePayMilestone2 = async (m2: any) => {
    if (!m2?.id) return;
    setIsProcessingPayment(true);
    const amountToPay = Number(m2.amount || 0);

    let orderId: string;
    let keyId: string;
    try {
      const orderRes = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, paymentId: m2.id }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to initialize payment');
      orderId = orderData.orderId;
      keyId = orderData.keyId;
    } catch (err) {
      console.error('Error creating milestone 2 payment order:', err);
      setIsProcessingPayment(false);
      return;
    }

    const logoUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/new-logo.png`
      : '/new-logo.png';

    const options = {
      key: keyId,
      order_id: orderId,
      amount: amountToPay * 100, // Amount in paise
      currency: "INR",
      name: "Lightmaps",
      description: `50% Final Release Payment for ${project?.project_name || 'Project'}`,
      image: logoUrl,
      handler: async function (response: any) {
        try {
          const verifyRes = await fetch('/api/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: id,
              paymentId: m2.id,
              kind: 'milestone2',
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.error || 'Payment verification failed');
          }

          setProject((prev: any) => ({ ...prev, payment_status: 'paid' }));
          setPaymentList((prev: any[]) => prev.map(p => p.id === m2.id ? { ...p, status: 'completed', transaction_id: response.razorpay_payment_id } : p));
          router.push(`/architect/payments/success?project_id=${id}&amount=${amountToPay}&transaction_id=${response.razorpay_payment_id}`);
        } catch (err) {
          console.error('Milestone 2 payment error:', err);
          router.push(`/architect/payments/failed?project_id=${id}&amount=${amountToPay}`);
        } finally {
          setIsProcessingPayment(false);
        }
      },
      prefill: {
        name: userProfile?.name || "",
        email: userProfile?.email || "",
      },
      theme: { color: "#F59E0B" }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  // Check if milestone balance payment (M2) is still pending before allowing revision request
  const pendingBalancePayment = paymentList.find(
    (p) => p.status === 'pending' && p.invoice_number?.includes('M2')
  );

  const handleRequestRevisionClick = () => {
    if (pendingBalancePayment) {
      setShowPaymentGateModal(true);
    } else {
      router.push(`/architect/projects/${id}/revision-request`);
    }
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
              href="/architect/projects"
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-955 transition-colors flex items-center justify-center flex-shrink-0"
              title="Back to projects"
            >
              <i className="bx bx-chevron-left text-2xl"></i>
            </Link>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold text-neutral-900 tracking-tight leading-tight">{project.project_name}</h2>
                <button
                  onClick={copyClientLink}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
                  title="Copy direct shareable approval link for end-homeowner"
                >
                  <i className="bx bx-share-alt text-xs"></i>
                  <span>{copiedLink ? 'Link Copied!' : 'Share with Client'}</span>
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Project Plan: {project.pricing_plans?.name || 'N/A'}
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
                  {/* Connecting Line to next step (behind circles) */}
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
          {/* Tab Container Card */}
          <div className="bg-white border border-neutral-200 rounded-sm py-6 pt-0 font-sans text-neutral-800">
            {/* Tabs Menu */}
            <div className="border-b border-neutral-200 mb-6 bg-white flex items-center justify-between pl-6 pr-3 h-14">
              <div className="flex space-x-8 h-full -mb-px">
                {['Overview', 'Deliverables', 'Revisions', 'Activity'].map((tab) => {
                  const isCurrent = activeTab === tab;
                  const isDisabled = project?.status === 'Submitted' && tab !== 'Overview';
                  return (
                    <button
                      key={tab}
                      type="button"
                      disabled={isDisabled}
                      title={isDisabled ? 'Available once the project has moved past the initial submission stage' : undefined}
                      onClick={() => setActiveTab(tab as any)}
                      className={`h-full text-sm font-semibold transition-all relative flex items-center space-x-1.5 border-b-2 ${isDisabled
                        ? 'opacity-40 cursor-not-allowed text-neutral-400 border-transparent'
                        : 'cursor-pointer'
                        } ${isCurrent
                          ? 'text-amber-600 border-amber-600'
                          : isDisabled
                            ? ''
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
                      {isDisabled && (
                        <i className="bx bx-lock text-[10px] text-neutral-400"></i>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'Revisions' && (
                <div className="flex items-center h-full">
                  <button
                    onClick={handleRequestRevisionClick}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-sm text-sm font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-amber-500/10"
                  >
                    <i className="bx bx-comment-edit text-base"></i>
                    <span>Request Revision</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tab content */}
            <div className="">
              {activeTab === 'Overview' && (
                <div className="space-y-6">
                  {/* End-Client Feedback & Approval Card */}
                  <div className="px-6 pt-4">
                    <div className="bg-neutral-900 text-white rounded-lg p-5 shadow-sm space-y-4 font-sans">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                            <i className="bx bx-check-shield text-xl"></i>
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-bold text-neutral-100">End-Homeowner Approval & Feedback</h3>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                project.status === 'Approved'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : revisions.some((r: any) => r.description?.includes('CLIENT FEEDBACK:'))
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                              }`}>
                                {project.status === 'Approved' ? 'Approved by Client' : revisions.some((r: any) => r.description?.includes('CLIENT FEEDBACK:')) ? 'Client Feedback Received' : 'Awaiting Homeowner Review'}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-400 mt-0.5">Client approval portal for {project.client_name || 'Homeowner'}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={copyClientLink}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-md text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
                          >
                            <i className="bx bx-share-alt text-sm"></i>
                            <span>{copiedLink ? 'Copied Link!' : 'Copy Shareable Link'}</span>
                          </button>
                          <Link
                            href={`/client/project/${id}`}
                            target="_blank"
                            className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 rounded-md text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
                          >
                            <i className="bx bx-external-link text-sm"></i>
                            <span>Open Client View</span>
                          </Link>
                        </div>
                      </div>

                      {/* Display Client Feedback log if any */}
                      {revisions.filter((r: any) => r.description?.includes('CLIENT')).length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">Homeowner Notes & Submissions</span>
                          {revisions.filter((r: any) => r.description?.includes('CLIENT')).map((rev: any) => (
                            <div key={rev.id} className="bg-neutral-950/90 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-200">
                              <div className="flex justify-between items-center text-[10px] text-neutral-450 mb-1">
                                <span className="font-mono">Submitted: {new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="font-bold text-amber-400 uppercase">{rev.status}</span>
                              </div>
                              <p className="whitespace-pre-line leading-relaxed text-neutral-200 font-medium">{rev.description}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">
                          Share the direct link with your client ({project.client_name}). Homeowners can inspect project files, click &quot;Approve Design&quot;, or submit feedback notes directly to your workspace.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Payment Required banner if pending payment */}
                  {project.payment_status !== 'paid' && (
                    <div className="px-6">
                      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm animate-fade-in font-sans">
                        {/* Title Bar */}
                        <div className="bg-neutral-50 px-6 py-3.5 border-b border-neutral-200 flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <i className="bx bx-receipt text-neutral-500 text-lg"></i>
                            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                              {paymentList.length > 1 ? '50/50 Milestone Installments Invoice' : `Pending Invoice — ${payment?.invoice_number || `INV-${new Date().getFullYear()}-001`}`}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 text-[10px] font-extrabold uppercase rounded-sm tracking-wider">
                            {project.payment_status === 'partial' ? '50% Deposit Paid' : 'Awaiting Payment'}
                          </span>
                        </div>

                        {/* Invoice Body Grid */}
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Col 1: Invoice metadata & Milestone Breakdown */}
                          <div className="lg:col-span-2 space-y-4">
                            <div>
                              <h4 className="text-base font-bold text-neutral-900">{project.project_name}</h4>
                              <p className="text-xs text-neutral-450 mt-0.5">Lighting Design Project Invoice</p>
                            </div>

                            {paymentList.length > 1 ? (
                              <div className="space-y-2.5 border-t border-neutral-100 pt-4">
                                <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider block">Payment Schedule Breakdown</span>
                                
                                {/* Milestone 1 */}
                                <div className="flex justify-between items-center bg-neutral-50 p-3 rounded border border-neutral-200 text-xs">
                                  <div>
                                    <span className="font-bold text-neutral-800 block">Milestone 1 — 50% Upfront Deposit</span>
                                    <span className="text-neutral-450 text-[11px] block">{paymentList[0]?.invoice_number}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-neutral-900 block">₹{Number(paymentList[0]?.amount || 0).toLocaleString('en-IN')}</span>
                                    <span className={`text-[10px] font-extrabold uppercase ${paymentList[0]?.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {paymentList[0]?.status === 'completed' ? 'Paid' : 'Pending'}
                                    </span>
                                  </div>
                                </div>

                                {/* Milestone 2 */}
                                <div className="flex justify-between items-center bg-neutral-50 p-3 rounded border border-neutral-200 text-xs">
                                  <div>
                                    <span className="font-bold text-neutral-800 block">Milestone 2 — 50% Final Release Balance</span>
                                    <span className="text-neutral-450 text-[11px] block">{paymentList[1]?.invoice_number}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-neutral-900 block">₹{Number(paymentList[1]?.amount || 0).toLocaleString('en-IN')}</span>
                                    <span className={`text-[10px] font-extrabold uppercase ${paymentList[1]?.status === 'completed' ? 'text-emerald-600' : (project.status === 'Ready for Client Review' || project.status === 'Approved' || deliverables.length > 0) ? 'text-amber-600 font-bold animate-pulse' : 'text-neutral-500'}`}>
                                      {paymentList[1]?.status === 'completed' 
                                        ? 'Paid' 
                                        : (project.status === 'Ready for Client Review' || project.status === 'Approved' || deliverables.length > 0)
                                          ? 'Payment Due (Design Complete)' 
                                          : 'Due After Design Completion'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-neutral-100 pt-4 text-xs">
                                <div>
                                  <span className="text-neutral-400 font-semibold block">Client</span>
                                  <span className="text-neutral-700 font-bold block mt-1">{project.client_name}</span>
                                </div>
                                <div>
                                  <span className="text-neutral-400 font-semibold block">Billing Plan</span>
                                  <span className="text-neutral-700 font-bold block mt-1">{project.pricing_plans?.name || 'Standard Plan'}</span>
                                </div>
                                <div>
                                  <span className="text-neutral-400 font-semibold block">Date Issued</span>
                                  <span className="text-neutral-700 font-bold block mt-1">
                                    {payment?.created_at 
                                      ? new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Col 2: Pricing Summary Column & Pay Action Button */}
                          <div className="lg:border-l lg:border-dashed lg:border-neutral-200 lg:pl-6 flex flex-col justify-between space-y-5 lg:space-y-0">
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-neutral-500">
                                <span>Project Total Fee:</span>
                                <span className="font-semibold text-neutral-800">₹{Number(project.calculated_price || payment?.amount || 0).toLocaleString('en-IN')}</span>
                              </div>
                              {paymentList.length > 1 && (
                                <div className="flex justify-between text-neutral-500">
                                  <span>Amount Paid So Far:</span>
                                  <span className="font-semibold text-emerald-600">
                                    ₹{paymentList.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString('en-IN')}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-neutral-200/60 pt-2 text-sm font-bold">
                                <span className="text-neutral-900">Current Due:</span>
                                <span className="text-amber-600">
                                  ₹{paymentList.length > 1 
                                    ? (paymentList[0]?.status !== 'completed' ? Number(paymentList[0]?.amount || 0) : Number(paymentList[1]?.amount || 0)).toLocaleString('en-IN')
                                    : Math.round(Number(payment?.amount || 0) * 1.18).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>

                            {paymentList.length > 1 ? (
                              paymentList[0]?.status !== 'completed' ? (
                                <button
                                  onClick={handleMockPayment}
                                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-sm transition-all shadow-md shadow-amber-500/10 active:scale-[0.98] cursor-pointer text-center"
                                >
                                  Pay 50% Deposit (₹{Number(paymentList[0]?.amount || 0).toLocaleString('en-IN')})
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePayMilestone2(paymentList[1])}
                                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-sm transition-all shadow-md shadow-amber-500/10 active:scale-[0.98] cursor-pointer text-center"
                                >
                                  Pay Remaining 50% Balance (₹{Number(paymentList[1]?.amount || 0).toLocaleString('en-IN')})
                                </button>
                              )
                            ) : (
                              <button
                                onClick={handleMockPayment}
                                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-sm transition-all shadow-md shadow-amber-500/10 active:scale-[0.98] cursor-pointer text-center"
                              >
                                Pay Invoice
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3-column parameter grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4 px-6">
                    <div>
                      <span className="text-xs text-neutral-400 font-medium block">Client</span>
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
                      <span className="text-xs text-neutral-400 font-medium block">Area</span>
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
                      <span className="text-xs text-neutral-400 font-medium block">Assigned Designer</span>
                      <span className="text-sm font-semibold text-neutral-800 mt-1 block">{designer?.name || 'Unassigned'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-neutral-400 font-medium block">Deadline</span>
                      <span className="text-sm font-semibold text-neutral-800 mt-1 block">
                        {project.deadline
                          ? new Date(project.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Not set'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-neutral-400 font-medium block">Files Uploaded</span>
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

                  {/* Lighting preferences pills */}
                  <div className="pt-6 border-t border-neutral-100 px-6">
                    <span className="text-xs font-bold text-neutral-450 tracking-wide block mb-3">Lighting Preferences</span>
                    {preferences.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic">No specific preferences selected.</p>
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
                  {/* Additional notes/remarks if any */}
                  {project.project_notes && (
                    <div className="pt-6 border-t border-neutral-100 px-6">
                      <span className="text-xs font-bold text-neutral-450 tracking-wide block mb-2">Project Notes</span>
                      <div className="bg-neutral-50/50 border border-neutral-200/80 rounded-xl p-4 text-xs text-neutral-600 font-medium leading-relaxed">
                        {project.project_notes}
                      </div>
                    </div>
                  )}

                  {/* Onboarding Files List */}
                  <div className="pt-6 border-t border-neutral-100 px-6">
                    <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block mb-3">Uploaded Onboarding Files</span>
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
                                <p className="text-[9px] text-neutral-400 mt-0.5 font-medium">{file.file_type} &middot; {getCategoryLabel(file.category, file.profiles?.role)}</p>
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
                  {paymentList.length > 1 && paymentList[1]?.status !== 'completed' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                      <div className="flex items-start space-x-3">
                        <i className="bx bx-lock-alt text-amber-600 text-2xl shrink-0 mt-0.5"></i>
                        <div>
                          <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Final Deliverables Pending Balance</h4>
                          <p className="text-xs text-amber-700 mt-0.5">Settle the remaining 50% milestone balance (₹{Number(paymentList[1]?.amount || 0).toLocaleString('en-IN')}) to unlock high-res layout plans and CAD packages.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePayMilestone2(paymentList[1])}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase rounded-sm transition-all shadow-md shadow-amber-500/10 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Pay Remaining Balance
                      </button>
                    </div>
                  )}

                  {deliverables.length === 0 ? (
                    <div className="py-12 text-center text-sm text-neutral-450 font-medium space-y-2 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                      <i className="bx bx-file-blank text-3xl text-neutral-300"></i>
                      <p className="font-medium">Deliverables will appear here once ready.</p>
                      <p className="text-xs text-neutral-400">Our design team is preparing the deliverables for your review.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {deliverables.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-xl hover: border-l-4 border-amber-500 transition-all">
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
                              <i className={`${getFileIcon(file.category)} text-xl`}></i>
                            </div>
                            <div className="overflow-hidden min-w-0">
                              <p className="font-semibold text-neutral-800 text-sm truncate">{file.file_name}</p>
                              <p className="text-[10px] text-neutral-405 mt-0.5 font-medium">{getCategoryLabel(file.category, file.profiles?.role)}</p>
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
                      <p className="font-medium">No revision requests have been filed.</p>
                      <p className="text-xs text-neutral-400">If changes are needed, click &apos;Request Revision&apos; above.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {revisions.map((rev) => {
                        const [architectRequest, designerNotesPart] = (rev.description || '').split('\n\n=== DESIGNER_RESOLUTION ===\n');
                        const isCompleted = !!designerNotesPart;
                        const isPending = rev.status === 'pending';

                        return (
                          <div key={rev.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
                            {/* Header row: Date + Status */}
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-neutral-400 font-medium">
                                Requested: {new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-md font-semibold border ${isPending
                                ? 'bg-amber-50 border-amber-100 text-amber-700'
                                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                }`}>
                                {isPending ? 'Awaiting Review' : 'Resolved'}
                              </span>
                            </div>

                            {/* Request content */}
                            <div className="space-y-1">
                              <span className="text-sm font-medium text-neutral-400 block">Your Request</span>
                              <p className="text-md text-neutral-800 font-medium leading-relaxed">{architectRequest}</p>
                            </div>

                            {/* Designer Response if resolved */}
                            {isCompleted ? (
                              <div className="pl-4 border-l-2 border-amber-500/80 space-y-1 mt-2">
                                <span className="text-sm font-semibold text-amber-600 block">Designer&apos;s Response</span>
                                <p className="text-md text-neutral-600 font-semibold leading-relaxed">{designerNotesPart}</p>
                              </div>
                            ) : (
                              <p className="text-sm text-neutral-450 font-medium italic mt-1.5 pl-4 border-l-2 border-amber-500/40">
                                Awaiting designer response...
                              </p>
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
                        title: 'Project Created',
                        desc: `Onboarded project scope for client ${project.client_name || 'Homeowner'}`,
                        icon: 'bx-folder-plus',
                        color: 'bg-amber-50 text-amber-600 border-amber-200'
                      });
                    }

                    files.forEach((f: any) => {
                      events.push({
                        id: f.id,
                        date: f.created_at || project.created_at,
                        title: `File Uploaded: ${f.file_name}`,
                        desc: `Uploaded onboarding document (${f.file_type || 'Asset'})`,
                        icon: 'bx-file',
                        color: 'bg-blue-50 text-blue-600 border-blue-200'
                      });
                    });

                    deliverables.forEach((d: any) => {
                      events.push({
                        id: d.id,
                        date: d.created_at || project.updated_at || project.created_at,
                        title: `Deliverable Uploaded: ${d.file_name}`,
                        desc: `Design asset delivered by staff designer`,
                        icon: 'bx-layer',
                        color: 'bg-indigo-50 text-indigo-600 border-indigo-200'
                      });
                    });

                    revisions.forEach((r: any) => {
                      events.push({
                        id: r.id,
                        date: r.created_at || project.created_at,
                        title: r.description?.includes('CLIENT FEEDBACK:') ? 'Homeowner Feedback Submitted' : `Revision Request (${r.status?.toUpperCase()})`,
                        desc: r.description,
                        icon: 'bx-comment-dots',
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
      </main>

      {/* Razorpay Checkout Modal Overlay */}
      <Modal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} maxWidthClassName="max-w-lg">
          <div className="overflow-hidden p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Secure Checkout</h3>
                <p className="text-xs text-neutral-450 mt-1">Complete your project payment securely via Razorpay</p>
              </div>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <i className="bx bx-x text-lg"></i>
              </button>
            </div>

            <div className="space-y-4 bg-neutral-50/50 rounded-xl p-4 border border-neutral-200/50">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500 font-medium">Project</span>
                <span className="text-neutral-800 font-semibold text-right max-w-[200px] truncate">{project.project_name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500 font-medium">Invoice Number</span>
                <span className="text-neutral-850 font-semibold">{payment?.invoice_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500 font-medium">Plan Tier</span>
                <span className="text-neutral-850 font-semibold">{project.pricing_plans?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500 font-medium">Subtotal</span>
                <span className="text-neutral-850 font-semibold">₹{Number(payment?.amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500 font-medium">Estimated GST (18%)</span>
                <span className="text-neutral-850 font-semibold">₹{Math.round(Number(payment?.amount || 0) * 0.18).toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-3 border-t border-neutral-200 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-neutral-800">Grand Total</span>
                <span className="text-lg font-bold text-amber-600">₹{Math.round(Number(payment?.amount || 0) * 1.18).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <button
              onClick={handleMockPayment}
              disabled={isProcessingPayment}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {isProcessingPayment ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="whitespace-nowrap">Connecting to Razorpay...</span>
                </>
              ) : (
                <span className="whitespace-nowrap">Pay Now with Razorpay</span>
              )}
            </button>
          </div>
      </Modal>

      {/* Payment Gate Modal — shown when M2 balance is pending and architect tries to request a revision */}
      <Modal isOpen={showPaymentGateModal && !!pendingBalancePayment} onClose={() => setShowPaymentGateModal(false)} maxWidthClassName="max-w-lg">
          <div className="overflow-hidden font-sans">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <i className="bx bx-lock-alt text-xl text-amber-600"></i>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Complete Payment to Continue</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Revision requests require full payment</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentGateModal(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                >
                  <i className="bx bx-x text-lg"></i>
                </button>
              </div>

              {/* Amount callout */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-1">
                <p className="text-xs text-amber-700 font-semibold">Outstanding Balance Payment</p>
                <p className="text-2xl font-black text-neutral-900">
                  ₹{Number(pendingBalancePayment?.amount || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-neutral-500 font-medium">
                  {pendingBalancePayment?.invoice_number || '50% Balance — Final Instalment'}
                </p>
              </div>

              {/* Explanation */}
              <div className="space-y-3">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Your design is complete! 🎉 To protect our designers&apos; work, revision requests are only available after the final balance payment is cleared. Please complete the payment to unlock this feature.
                </p>
                <div className="flex items-start space-x-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <i className="bx bx-info-circle text-blue-500 text-sm mt-0.5 shrink-0"></i>
                  <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                    Once payment is completed, you&apos;ll be able to request revisions and the design team will continue working on your project.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-3 pt-1">
                <button
                  onClick={() => setShowPaymentGateModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 font-bold text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowPaymentGateModal(false);
                    handlePayMilestone2(pendingBalancePayment);
                  }}
                  disabled={isProcessingPayment}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap shrink-0"
                >
                  {isProcessingPayment ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="whitespace-nowrap">Processing...</span>
                    </>
                  ) : (
                    <>
                      <i className="bx bx-credit-card text-sm"></i>
                      <span className="whitespace-nowrap">Pay ₹{Number(pendingBalancePayment?.amount || 0).toLocaleString('en-IN')} Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
      </Modal>
    </>
  );
}
