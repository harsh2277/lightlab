'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import CustomSelect from '../../../../components/ui/CustomSelect';
import Portal from '../../../../components/ui/Portal';
import { useToast, SkeletonDashboard, InputField } from '@/components/ui';

function generateClientPassword() {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
}

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  base_price_per_sq_ft: string;
  min_sq_ft: string;
}

interface ArchitectProfile {
  id: string;
  name: string;
  email: string;
}

const UI_PLANS = [
  {
    id: 'essential',
    name: 'Amplex Essential',
    sqft: 'UP TO 1,500 SQ.FT.',
    discount: '50% off',
    price: 4999,
    originalPrice: 10000,
    features: ['Lighting Layout', 'Fixture Suggestions'],
    bottomFeatures: ['1 Revision'],
  },
  {
    id: 'professional',
    name: 'Amplex Professional',
    sqft: '1,501 - 5,000 SQ.FT.',
    discount: '50% off',
    popular: true,
    price: 9999,
    originalPrice: 20000,
    features: ['Lighting Layout', 'Fixture Suggestions', 'Lux Guidance'],
    bottomFeatures: ['2 Revisions'],
  },
  {
    id: 'premium',
    name: 'Amplex Premium',
    sqft: '5,001 - 10,000 SQ.FT.',
    discount: '50% off',
    price: 24999,
    originalPrice: 50000,
    features: ['Detailed Lighting Layout', 'Lux Calculations'],
    bottomFeatures: ['3 Revisions', '2 Site Visits'],
  },
  {
    id: 'enterprise',
    name: 'Amplex Enterprise',
    sqft: 'ABOVE 10,000 SQ.FT.',
    customQuote: true,
    features: ['Complete Lighting Design Support', 'Multiple Revisions', 'Dedicated Designer'],
    bottomFeatures: ['Site Visits as per requirements'],
  }
];

const ADDONS_DATA = [
  { id: '3d_vis', name: '3D Lighting Visualization', description: 'Photorealistic 3D render', price: 5000 },
  { id: 'site_visit', name: 'Site Visit & Consultation', description: 'On-site consultation', price: 2500 }
];

const LIGHTING_TYPES = [
  'COB Spot Light',
  'Magnetic Track Lights',
  'Profile Lights',
  'Linear Stop Lights',
  'Flexible Neon Light',
  'Wall Washer Light',
  'Linear Wall Washer',
  'Curtain Grazer Light',
  'Track Light',
  'Down Light',
  'Surface Cylinder Light',
  'Surface Panel Light',
  'Mirror Light',
  'Office Hanging Linear Lights',
  'Office Hanging Circle Lights',
];

export default function AdminProjectCreationWizard() {
  const router = useRouter();
  const supabase = createClient();

  const [activeStep, setActiveStep] = useState(1);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [architects, setArchitects] = useState<ArchitectProfile[]>([]);
  const [designers, setDesigners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attemptedNext, setAttemptedNext] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  // Form State
  const [selectedPlanId, setSelectedPlanId] = useState('professional'); // Default popular
  const [assignedArchitectId, setAssignedArchitectId] = useState('');
  const [assignedDesignerId, setAssignedDesignerId] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [addonsList, setAddonsList] = useState<any[]>(ADDONS_DATA);

  const [projectDetails, setProjectDetails] = useState({
    projectName: '',
    clientName: '',
    projectType: '',
    siteLocation: '',
    areaSqFt: '',
    budgetRange: '',
    timeline: '',
    stylePreference: '',
    notes: '',
  });

  const [lightingPreferences, setLightingPreferences] = useState<string[]>([]);
  const [otherLightingSelected, setOtherLightingSelected] = useState(false);
  const [otherLightingText, setOtherLightingText] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileCategory, setFileCategory] = useState('layout');
  const [fileAreaSqFt, setFileAreaSqFt] = useState('');
  const [fileAreaMismatchConfirmed, setFileAreaMismatchConfirmed] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch plans
        const { data: plansData, error: plansError } = await supabase
          .from('pricing_plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('min_sq_ft', { ascending: true });

        if (plansError) throw plansError;
        setPlans(plansData || []);

        if (plansData && plansData.length > 0) {
          const mappedUiPlans = plansData.map((d: any) => {
            const defaultMatch = UI_PLANS.find(p => p.name.toLowerCase() === d.name.toLowerCase() || p.id === d.id);
            const priceNum = Number(d.base_price_per_sq_ft || d.flat_price || 0);
            const bottomFeatures = (Array.isArray(d.bottom_features) && d.bottom_features.length > 0)
              ? d.bottom_features
              : (defaultMatch?.bottomFeatures || ['1 Revision']);
            const bottomSet = new Set(bottomFeatures.map((s: string) => s.toLowerCase()));
            const featuresArr = (Array.isArray(d.features) && d.features.length > 0)
              ? d.features
              : (d.description
                ? d.description.split(',').map((s: string) => s.trim()).filter(Boolean)
                : (defaultMatch?.features || ['Lighting Layout'])
              ).filter((f: string) => !bottomSet.has(f.toLowerCase()));

            const isCustomQuote = d.is_custom_quote || (priceNum === 0 && !d.flat_price) || d.base_price_per_sq_ft === null;

            return {
              id: d.id, // Real DB UUID
              name: d.name,
              sqft: d.sqft_label || defaultMatch?.sqft || (d.min_sq_ft ? `MIN ${Number(d.min_sq_ft).toLocaleString()} SQ.FT.` : 'CUSTOM AREA'),
              discount: isCustomQuote ? undefined : (d.discount_tag || defaultMatch?.discount || '50% off'),
              popular: Boolean(d.is_popular),
              price: priceNum > 0 ? priceNum : (defaultMatch?.price || null),
              originalPrice: d.original_price ? Number(d.original_price) : (defaultMatch?.originalPrice || (priceNum > 0 ? priceNum * 2 : null)),
              customQuote: isCustomQuote,
              features: featuresArr,
              bottomFeatures,
            };
          });

          setUiPlans(mappedUiPlans);
        }

        // Fetch dynamic addons
        const { data: addonsData, error: addonsError } = await supabase
          .from('pricing_addons')
          .select('id, name, description, price, price_label')
          .eq('is_active', true)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        if (!addonsError && addonsData && addonsData.length > 0) {
          const mappedAddons = addonsData.map((d: any) => {
            const numPrice = Number(d.price) || (d.price_label ? parseFloat(d.price_label.replace(/[^0-9.]/g, '')) : 0) || 0;
            return {
              id: d.id,
              name: d.name,
              description: d.description || (d.name.toLowerCase().includes('3d') ? 'Photorealistic 3D render of lighting design' : 'On-site consultation with our lighting expert'),
              price: numPrice,
              priceLabel: d.price_label || `₹${numPrice.toLocaleString('en-IN')}`,
            };
          });
          setAddonsList(mappedAddons);
        }

        // Fetch architects
        const { data: archsData, error: archsError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('role', 'architect');

        if (archsError) throw archsError;
        setArchitects(archsData || []);

        // Fetch designers
        const { data: desData, error: desError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('role', 'designer');

        if (desError) throw desError;
        setDesigners(desData || []);
      } catch (err: any) {
        console.error('Error loading initialization data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getDbPlanId = () => {
    if (plans.length === 0) return selectedPlanId;
    const match = plans.find(p => p.id === selectedPlanId || p.name.toLowerCase() === uiPlans.find(u => u.id === selectedPlanId)?.name.toLowerCase());
    return match?.id || selectedPlanId;
  };

  const [uiPlans, setUiPlans] = useState(UI_PLANS);

  useEffect(() => {
    const syncCustomRates = () => {
      try {
        const storedOverridesStr = localStorage.getItem('lightmap_pricing_plan_overrides');
        if (storedOverridesStr) {
          const overrides = JSON.parse(storedOverridesStr);
          setUiPlans(prev =>
            prev.map(p => {
              const ov = overrides[p.id];
              if (ov) {
                return {
                  ...p,
                  name: ov.name || p.name,
                  sqft: ov.sqft || p.sqft,
                  price: ov.price !== undefined ? ov.price : p.price,
                  originalPrice: ov.originalPrice !== undefined ? ov.originalPrice : p.originalPrice,
                  discount: ov.discount !== undefined ? ov.discount : p.discount,
                  features: ov.features || p.features,
                  bottomFeatures: ov.bottomFeatures || p.bottomFeatures
                };
              }
              return p;
            })
          );
        }
      } catch (e) {
        console.error(e);
      }
    };

    syncCustomRates();
    window.addEventListener('storage', syncCustomRates);
    return () => window.removeEventListener('storage', syncCustomRates);
  }, []);

  const calculateTotalPrice = () => {
    const plan = uiPlans.find(p => p.id === selectedPlanId);
    if (!plan || plan.customQuote) return 0;
    const planPrice = plan.price || 0;
    const addonsPrice = selectedAddons.reduce((sum, addonId) => {
      const addon = addonsList.find(a => a.id === addonId);
      return sum + (addon ? addon.price : 0);
    }, 0);
    return planPrice + addonsPrice;
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateTotalPrice();
    return Math.round(subtotal * 1.18);
  };

  const handleAreaChange = (val: string) => {
    if (val !== '' && (Number(val) < 0 || !/^\d*$/.test(val))) return;
    setProjectDetails(prev => ({ ...prev, areaSqFt: val }));
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      if (num <= 1500) {
        setSelectedPlanId('essential');
      } else if (num <= 5000) {
        setSelectedPlanId('professional');
      } else if (num <= 10000) {
        setSelectedPlanId('premium');
      } else {
        setSelectedPlanId('enterprise');
      }
    }
  };

  const handleNext = () => {
    setErrorMsg('');
    if (activeStep === 1) {
      if (!selectedPlanId) {
        setErrorMsg('Please select a pricing plan.');
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      setAttemptedNext(true);
      if (!projectDetails.projectName || !projectDetails.clientName || !projectDetails.projectType || !projectDetails.siteLocation || !projectDetails.areaSqFt || !projectDetails.timeline) {
        setErrorMsg('Please complete all required fields (*).');
        return;
      }
      setActiveStep(3);
    }
  };

  const handleAddonToggle = (addonId: string) => {
    setSelectedAddons(prev =>
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const handlePreferenceToggle = (pref: string) => {
    setLightingPreferences(prev =>
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    );
  };

  const saveProject = async (isPaid: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      const serial = `KL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const clientUsername = `client_${projectDetails.clientName.toLowerCase().replace(/\s+/g, '')}_${Math.floor(100 + Math.random() * 905)}`;
      const totalCost = calculateGrandTotal();

      // 1. Insert Project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          project_id_serial: serial,
          architect_id: assignedArchitectId || null,
          assigned_designer_id: assignedDesignerId || null,
          project_name: projectDetails.projectName,
          client_name: projectDetails.clientName,
          project_type: projectDetails.projectType,
          site_location: projectDetails.siteLocation,
          area_sq_ft: Number(projectDetails.areaSqFt) || 0,
          budget_range: projectDetails.budgetRange || 'Standard',
          timeline: projectDetails.timeline,
          pricing_plan_id: getDbPlanId(),
          calculated_price: totalCost,
          payment_status: isPaid ? 'paid' : 'pending',
          status: 'In Design',
          client_username: clientUsername,
          client_password_hash: generateClientPassword(),
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Insert Lighting Preferences
      const allLightingPreferences = [
        ...lightingPreferences,
        ...(otherLightingSelected && otherLightingText.trim() ? [`Other: ${otherLightingText.trim()}`] : []),
      ];
      if (allLightingPreferences.length > 0) {
        const prefInserts = allLightingPreferences.map(pref => ({
          project_id: project.id,
          preference_name: pref
        }));
        const { error: prefError } = await supabase
          .from('project_lighting_preferences')
          .insert(prefInserts);
        if (prefError) throw prefError;
      }

      // 3. Upload Files if any
      for (const file of uploadedFiles) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('category', fileCategory);

          const uploadRes = await fetch(`/api/projects/${project.id}/files`, {
            method: 'POST',
            body: formData,
          });
          const uploadData = await uploadRes.json();
          if (uploadData.error) throw new Error(uploadData.error);
        } catch (storageError) {
          console.error('Storage upload error:', storageError);
        }
      }

      // 5. Create Payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          project_id: project.id,
          amount: totalCost,
          status: isPaid ? 'completed' : 'pending',
          transaction_id: isPaid ? `manual_${Date.now()}` : null,
          invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        });
      if (paymentError) throw paymentError;

      toastSuccess('Project created successfully.');
      router.push('/admin/projects');
    } catch (err: any) {
      console.error('Error saving project:', err);
      const message = err.message || 'Something went wrong while saving the project.';
      setErrorMsg(message);
      toastError(message);
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!selectedPlanId) {
      setErrorMsg('Please select a pricing plan.');
      return;
    }
    setAttemptedNext(true);
    if (!projectDetails.projectName || !projectDetails.clientName || !projectDetails.projectType || !projectDetails.siteLocation || !projectDetails.areaSqFt || !projectDetails.timeline) {
      setErrorMsg('Please complete all required fields (*) in the Project Details step.');
      return;
    }
    const plan = UI_PLANS.find(p => p.id === selectedPlanId);
    if (plan?.customQuote) {
      setSubmitting(true);
      await saveProject(false);
    } else {
      setShowPaymentModal(true);
    }
  };

  const stepsList = [
    { num: 1, label: 'Select Plan' },
    { num: 2, label: 'Project Details' },
    { num: 3, label: 'Preferences & Blueprint' }
  ];

  if (loading) return <SkeletonDashboard />;

  const selectedPlan = UI_PLANS.find(p => p.id === selectedPlanId);

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-sans pb-12 pt-2">

      {/* Top Clean Heading (No Breadcrumbs) */}
      <div className="text-center">
        <h2 className="text-xl font-medium text-neutral-900 tracking-tight">Configure New Project Layout</h2>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm font-medium flex items-center space-x-2 max-w-3xl mx-auto">
          <i className="bx bx-error-circle text-lg animate-pulse"></i>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Premium Progress Stepper Line */}
      <div className="max-w-xl mx-auto pb-6">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-neutral-200 z-0">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${((activeStep - 1) / (stepsList.length - 1)) * 100}%` }}
            />
          </div>
          {stepsList.map((s) => {
            const isActive = activeStep === s.num;
            const isCompleted = activeStep > s.num;
            return (
              <button
                key={s.num}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => {
                  if (s.num < activeStep || (s.num === 2 && selectedPlanId) || (s.num === 3 && selectedPlanId && projectDetails.projectName)) {
                    setActiveStep(s.num);
                  }
                }}
                disabled={s.num > activeStep}
                className="relative z-10 flex flex-col items-center focus:outline-none"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 border-2 ${isActive ? 'bg-neutral-950 border-neutral-950 text-white ring-4 ring-neutral-950/10' : isCompleted ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-neutral-200 text-neutral-400'}`}>
                  {isCompleted ? <i className="bx bx-check text-sm"></i> : s.num}
                </div>
                <span className={`absolute top-10 text-sm font-medium whitespace-nowrap transition-colors duration-300 ${isActive ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split-Screen Configurator Workspace */}
      <div className={activeStep === 1 ? "block pt-4" : "grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pt-4"}>

        {/* Left Side: Active Step Card Only / Full Width for Step 1 */}
        <div className={activeStep === 1 ? "w-full space-y-4" : "lg:col-span-2 space-y-4"}>
          <div className="bg-white border border-neutral-200 rounded-md p-6.5 min-h-[420px] transition-all duration-300">
            {/* STEP 1: Select Plan */}
            {activeStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-medium text-neutral-900 font-sans">Choose Your Amplex Plan</h2>
                  <p className="text-sm text-neutral-450 mt-0.5">Select a plan based on your project size. Pricing is auto-calculated — no negotiations.</p>
                </div>

                {/* Dynamic Columns Grid of Pricing Cards */}
                <div className={`grid ${
                  uiPlans.length <= 1 ? 'grid-cols-1 max-w-md' :
                  uiPlans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl' :
                  uiPlans.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                  uiPlans.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                  'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
                } gap-4 lg:gap-5 mt-6`}>
                  {uiPlans.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`border rounded-md p-6 bg-white flex flex-col justify-between space-y-6 hover: transition-all duration-200 relative h-full cursor-pointer ${isSelected ? 'border-amber-500 ring-1 ring-amber-500' : 'border-neutral-200 hover:border-neutral-300'}`}
                      >
                        {p.popular && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm bg-amber-500 text-white px-2.5 py-0.5 rounded font-medium z-10 whitespace-nowrap">
                            Most Popular
                          </span>
                        )}

                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-medium text-neutral-400">{p.sqft}</span>
                            {p.discount && (
                              <span className="px-2 py-0.5 rounded text-sm font-medium border bg-amber-50 border-amber-100 text-amber-700">
                                {p.discount}
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-medium text-neutral-900 leading-snug">{p.name}</h3>

                          <div className="pt-4 border-t border-neutral-100 space-y-1">
                            <span className="text-sm text-neutral-400 font-medium block">Rate</span>
                            {p.customQuote ? (
                              <span className="text-lg font-medium text-neutral-900">Custom Quote</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[24px] font-medium text-neutral-900 leading-none">₹{p.price?.toLocaleString()}</span>
                                  <span className="text-sm text-neutral-400 font-medium"> / flat</span>
                                </div>
                                {p.originalPrice && (
                                  <span className="text-sm text-neutral-400/80 line-through block">₹{p.originalPrice.toLocaleString()}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <ul className="space-y-2.5 pt-4 border-t border-neutral-100">
                            {p.features.map((f, i) => (
                              <li key={i} className="text-sm text-neutral-500 font-medium flex items-start space-x-1.5">
                                <i className="bx bx-check text-amber-600 text-sm mt-0.5 flex-shrink-0"></i>
                                <span className="leading-tight">{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          {p.bottomFeatures && (
                            <div className="border-t border-neutral-100 pt-3 mt-4 text-left">
                              {p.bottomFeatures.map((bf, idx) => (
                                <div key={idx} className="text-sm text-neutral-500 font-medium flex items-center justify-start gap-1.5 mt-0.5">
                                  <i className="bx bx-sync text-neutral-400 text-sm"></i>
                                  <span>{bf}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlanId(p.id);
                              }}
                              className={`w-full py-2.5 text-xs font-medium rounded-md transition-all duration-200 cursor-pointer text-center active:scale-[0.98] ${isSelected ? 'bg-amber-500 hover:bg-amber-600 text-white ' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200'}`}
                            >
                              {isSelected ? 'Selected' : 'Select Plan'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add-ons Row */}
                <div className="border-t border-neutral-100 pt-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-900 font-sans">Add-on Services</h3>
                    <p className="text-sm text-neutral-450 mt-0.5">Optional services to enhance your project delivery.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addonsList.map((addon) => {
                      const isChecked = selectedAddons.includes(addon.id);
                      return (
                        <div
                          key={addon.id}
                          onClick={() => handleAddonToggle(addon.id)}
                          className={`border rounded-md p-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${isChecked ? 'border-amber-500 bg-amber-50/20' : 'border-neutral-200 hover:border-neutral-300'}`}
                        >
                          <div className="flex items-center space-x-3.5">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${isChecked ? 'bg-amber-500 border-amber-500 text-white' : 'border-neutral-300'}`}>
                              {isChecked && <i className="bx bx-check text-sm"></i>}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-neutral-700 block">{addon.name}</span>
                              <span className="text-sm text-neutral-400 mt-0.5 block">
                                {addon.description}
                              </span>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-amber-600">
                            +{addon.priceLabel || `₹${addon.price.toLocaleString('en-IN')}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!selectedPlanId && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium rounded-md flex items-center space-x-2">
                    <i className="bx bx-info-circle text-lg"></i>
                    <span>Please select a plan to continue to project details.</span>
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!selectedPlanId}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer ${selectedPlanId ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}
                  >
                    <span>Continue to Project Details</span>
                    <i className="bx bx-chevron-right text-sm"></i>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Project Specifications */}
            {activeStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h3 className="text-sm font-medium text-neutral-800">2. Project Details</h3>
                  <p className="text-sm text-neutral-450 mt-0.5">Provide client layout specifications and dimensions.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Project Name"
                    required
                    type="text"
                    value={projectDetails.projectName}
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, projectName: e.target.value }))}
                    placeholder="e.g. Oberoi Residency"
                    error={attemptedNext && !projectDetails.projectName ? 'Project name is required.' : undefined}
                  />

                  <InputField
                    label="Client Name"
                    required
                    type="text"
                    value={projectDetails.clientName}
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="e.g. Mr. Aditya Oberoi"
                    error={attemptedNext && !projectDetails.clientName ? 'Client name is required.' : undefined}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-600 mb-1">Assign Architect</label>
                      <CustomSelect
                        value={assignedArchitectId}
                        onChange={setAssignedArchitectId}
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...architects.map(a => ({ value: a.id, label: a.name }))
                        ]}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-600 mb-1">Assign Designer</label>
                      <CustomSelect
                        value={assignedDesignerId}
                        onChange={setAssignedDesignerId}
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...designers.map(d => ({ value: d.id, label: d.name }))
                        ]}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-neutral-600">Project Type *</label>
                    <CustomSelect
                      value={projectDetails.projectType}
                      onChange={(val) => setProjectDetails(prev => ({ ...prev, projectType: val }))}
                      options={[
                        { value: '', label: 'Select type...' },
                        { value: 'Residential Villa', label: 'Residential Villa' },
                        { value: 'Residential Apartment', label: 'Residential Apartment' },
                        { value: 'Office Space', label: 'Office Space' },
                        { value: 'Retail Store', label: 'Retail Store' },
                        { value: 'Hotel / Hospitality', label: 'Hotel / Hospitality' },
                        { value: 'Restaurant / Café', label: 'Restaurant / Café' },
                        { value: 'Showroom', label: 'Showroom' },
                        { value: 'Industrial / Warehouse', label: 'Industrial / Warehouse' },
                        { value: 'Healthcare Facility', label: 'Healthcare Facility' },
                        { value: 'Educational Institution', label: 'Educational Institution' },
                        { value: 'Other', label: 'Other' }
                      ]}
                      className="w-full"
                    />
                    {attemptedNext && !projectDetails.projectType && (
                      <p className="text-xs text-rose-500 font-medium">Project type is required.</p>
                    )}
                  </div>

                  <InputField
                    label="Site Location"
                    required
                    type="text"
                    value={projectDetails.siteLocation}
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, siteLocation: e.target.value }))}
                    placeholder="City, State"
                    error={attemptedNext && !projectDetails.siteLocation ? 'Site location is required.' : undefined}
                  />

                  <InputField
                    label="Total Area (sq.ft.)"
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={projectDetails.areaSqFt}
                    onChange={(e) => handleAreaChange(e.target.value)}
                    placeholder="e.g. 2500"
                    error={attemptedNext && !projectDetails.areaSqFt ? 'Total area is required.' : undefined}
                  />

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-neutral-600">Fixture Budget Range</label>
                    <CustomSelect
                      value={projectDetails.budgetRange}
                      onChange={(val) => setProjectDetails(prev => ({ ...prev, budgetRange: val }))}
                      options={[
                        { value: '', label: 'Select range...' },
                        { value: 'Under ₹5 Lakhs', label: 'Under ₹5 Lakhs' },
                        { value: '₹5 – 15 Lakhs', label: '₹5 – 15 Lakhs' },
                        { value: '₹15 – 30 Lakhs', label: '₹15 – 30 Lakhs' },
                        { value: '₹30 – 60 Lakhs', label: '₹30 – 60 Lakhs' },
                        { value: '₹60 Lakhs – 1 Crore', label: '₹60 Lakhs – 1 Crore' },
                        { value: 'Above ₹1 Crore', label: 'Above ₹1 Crore' }
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-neutral-600">Delivery Timeline *</label>
                    <CustomSelect
                      value={projectDetails.timeline}
                      onChange={(val) => setProjectDetails(prev => ({ ...prev, timeline: val }))}
                      options={[
                        { value: '', label: 'Select timeline...' },
                        { value: 'Within 1 week', label: 'Within 1 week' },
                        { value: '1 – 2 weeks', label: '1 – 2 weeks' },
                        { value: '2 – 4 weeks', label: '2 – 4 weeks' },
                        { value: '1 – 2 months', label: '1 – 2 months' },
                        { value: 'Flexible', label: 'Flexible' }
                      ]}
                      className="w-full"
                    />
                    {attemptedNext && !projectDetails.timeline && (
                      <p className="text-xs text-rose-500 font-medium">Delivery timeline is required.</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-neutral-600">Style Preference</label>
                    <CustomSelect
                      value={projectDetails.stylePreference}
                      onChange={(val) => setProjectDetails(prev => ({ ...prev, stylePreference: val }))}
                      options={[
                        { value: '', label: 'Select style...' },
                        { value: 'Modern', label: 'Modern' },
                        { value: 'Minimalist', label: 'Minimalist' },
                        { value: 'Luxury', label: 'Luxury' },
                        { value: 'Industrial', label: 'Industrial' },
                        { value: 'Traditional', label: 'Traditional' },
                        { value: 'Scandinavian', label: 'Scandinavian' },
                        { value: 'Art Deco', label: 'Art Deco' },
                        { value: 'Mid-Century Modern', label: 'Mid-Century Modern' },
                        { value: 'Other', label: 'Other' }
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="block text-sm font-medium text-neutral-600">Notes / Remarks</label>
                  <textarea
                    rows={3}
                    value={projectDetails.notes}
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Share details or requirements..."
                    className="w-full px-3.5 py-2.5 bg-neutral-50/50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:bg-white focus:border-amber-500 transition-colors font-medium"
                  />
                </div>

                <div className="pt-3 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 rounded-md text-sm font-medium text-neutral-600 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md transition-colors cursor-pointer"
                  >
                    Continue to Preferences
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Preferences & Files */}
            {activeStep === 3 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-sm font-medium text-neutral-800">3. Preferences & Attachments</h3>
                  <p className="text-sm text-neutral-450 mt-0.5">Submit architectural blueprints and design criteria preferences.</p>
                </div>

                <div className="space-y-3.5">
                  <span className="text-sm font-medium text-neutral-555 block">Lighting Type (Select all that apply)</span>
                  <div className="flex flex-wrap gap-2">
                    {LIGHTING_TYPES.map((pref) => {
                      const isChecked = lightingPreferences.includes(pref);
                      return (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => handlePreferenceToggle(pref)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${isChecked ? 'bg-amber-500 text-white border-amber-500' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border-neutral-200'}`}
                        >
                          {pref}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setOtherLightingSelected((v) => !v)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${otherLightingSelected ? 'bg-amber-500 text-white border-amber-500' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border-neutral-200'}`}
                    >
                      Any Others
                    </button>
                  </div>
                  {otherLightingSelected && (
                    <input
                      type="text"
                      value={otherLightingText}
                      onChange={(e) => setOtherLightingText(e.target.value)}
                      placeholder="Describe the other lighting type..."
                      className="w-full px-3.5 py-2 bg-neutral-50/50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:bg-white focus:border-amber-500 transition-colors font-medium text-neutral-800"
                    />
                  )}
                </div>

                <div className="border-t border-neutral-100 pt-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <span className="text-sm font-medium text-neutral-555 block">Attach Floor Layout Plan / Blueprints</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-neutral-500 font-medium whitespace-nowrap">File Category:</span>
                      <CustomSelect
                        value={fileCategory}
                        onChange={setFileCategory}
                        options={[
                          { value: 'layout', label: 'Architectural Layout' },
                          { value: 'electrical', label: 'Electrical Grid Map' },
                          { value: 'moodboard', label: 'Moodboard Reference' },
                          { value: 'other', label: 'Other Reference File' }
                        ]}
                      />
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-neutral-200 hover:border-amber-500 transition-colors rounded-md p-8 text-center bg-neutral-50/50 flex flex-col items-center justify-center min-h-[160px] relative cursor-pointer group">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const newFiles = Array.from(e.target.files || []);
                        if (newFiles.length) setUploadedFiles((prev) => [...prev, ...newFiles]);
                        e.target.value = '';
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <i className="bx bx-cloud-upload text-4xl text-neutral-400 mb-2 group-hover:text-amber-500 transition-colors"></i>
                    {uploadedFiles.length > 0 ? (
                      <p className="text-sm font-medium text-neutral-800">
                        {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} selected — click or drop to add more
                      </p>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-neutral-700">Drag & Drop blueprint layout files or browse</p>
                        <p className="text-sm text-neutral-400 mt-0.5">Supports PDF, DWG, DXF, PNG, JPG (Max 25MB each) — multiple files allowed</p>
                      </div>
                    )}
                  </div>

                  {uploadedFiles.length > 0 && (
                    <ul className="space-y-2">
                      {uploadedFiles.map((file, idx) => (
                        <li
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between px-3.5 py-2.5 bg-white border border-neutral-200 rounded-md text-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <i className="bx bx-file text-neutral-400 flex-shrink-0"></i>
                            <span className="text-neutral-800 font-medium truncate">{file.name}</span>
                            <span className="text-neutral-400 flex-shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-neutral-400 hover:text-rose-600 transition-colors flex-shrink-0 ml-2"
                            aria-label={`Remove ${file.name}`}
                          >
                            <i className="bx bx-x text-lg"></i>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-3 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 rounded-md text-sm font-medium text-neutral-600 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm rounded-md transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <i className="bx bx-check-circle text-sm"></i>
                        <span>Confirm & Create Project</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: STICKY Live Summary & Pricing Sidebar */}
        {activeStep !== 1 && (
          <div className="lg:col-span-1 lg:sticky lg:top-6">
            <div className="bg-neutral-900 text-white rounded-md p-6.5 border border-neutral-800 space-y-5">

              <div className="border-b border-white/10 pb-3 flex justify-between items-center">
                <h3 className="text-sm font-medium text-white">Live Summary</h3>
                <span className="text-sm bg-amber-500 text-white font-medium px-2 py-0.5 rounded-full">Configurator</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-sm text-neutral-400 font-medium block">Package Selection</span>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-md border border-white/10">
                    <span className="text-sm font-medium text-white">{selectedPlan?.name}</span>
                    <span className="text-sm text-amber-400 font-medium">{selectedPlan?.sqft}</span>
                  </div>
                </div>

                {/* Live Project specs */}
                {(projectDetails.projectName || projectDetails.clientName || projectDetails.areaSqFt || assignedArchitectId || assignedDesignerId) && (
                  <div className="space-y-2 bg-white/[0.02] p-3.5 rounded-md border border-white/5 text-sm space-y-2.5">
                    {projectDetails.projectName && (
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Project Name:</span>
                        <span className="font-medium text-white">{projectDetails.projectName}</span>
                      </div>
                    )}
                    {projectDetails.clientName && (
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Client:</span>
                        <span className="font-medium text-white">{projectDetails.clientName}</span>
                      </div>
                    )}
                    {projectDetails.areaSqFt && (
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Dimensions:</span>
                        <span className="font-medium text-white">{Number(projectDetails.areaSqFt).toLocaleString()} sq ft</span>
                      </div>
                    )}
                    {assignedArchitectId && (
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Architect:</span>
                        <span className="font-medium text-white">
                          {architects.find(a => a.id === assignedArchitectId)?.name || 'Assigned'}
                        </span>
                      </div>
                    )}
                    {assignedDesignerId && (
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Designer:</span>
                        <span className="font-medium text-white">
                          {designers.find(d => d.id === assignedDesignerId)?.name || 'Assigned'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Add-ons */}
                {selectedAddons.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm text-neutral-455 font-medium block">Add-ons Selected</span>
                    <div className="space-y-1.5">
                      {selectedAddons.map(id => {
                        const item = addonsList.find(a => a.id === id);
                        return (
                          <div key={id} className="flex justify-between items-center text-sm bg-white/5 px-2.5 py-1.5 rounded-md border border-white/10">
                            <span className="text-neutral-300 font-medium">{item?.name}</span>
                            <span className="text-neutral-200 font-medium">₹{item?.price.toLocaleString('en-IN')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Final Estimates */}
                <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-neutral-450">
                    <span>Subtotal Fee:</span>
                    <span>{selectedPlan?.customQuote ? 'Quote Pending' : `₹${selectedPlan?.price?.toLocaleString()}`}</span>
                  </div>

                  {selectedAddons.length > 0 && (
                    <div className="flex justify-between text-neutral-450">
                      <span>Add-ons Subtotal:</span>
                      <span>₹{selectedAddons.reduce((sum, id) => sum + (addonsList.find(a => a.id === id)?.price || 0), 0).toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {!selectedPlan?.customQuote && (
                    <div className="flex justify-between text-neutral-450">
                      <span>Estimated GST (18%):</span>
                      <span>₹{Math.round(calculateTotalPrice() * 0.18).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm font-medium text-white border-t border-white/5 pt-3.5">
                    <span>Grand Total Estimate:</span>
                    {selectedPlan?.customQuote ? (
                      <span className="text-amber-400 font-medium">Custom Quote</span>
                    ) : (
                      <span className="text-amber-400 font-medium">₹{Math.round(calculateTotalPrice() * 1.18).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Payment Confirmation Modal */}
      {showPaymentModal && (
        <Portal>
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white border border-neutral-200 rounded-md max-w-xl w-full p-6 space-y-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-55/10 text-amber-500 rounded-full flex items-center justify-center flex-shrink-0 border border-amber-100">
                  <i className="bx bx-credit-card-front text-xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-neutral-900">Verify Project Payment</h3>
                  <p className="text-sm text-neutral-455 mt-1">Confirm the payment status for <strong>{projectDetails.projectName}</strong> before submitting.</p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={submitting}
                  aria-label="Cancel and review"
                  className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors p-1 rounded"
                >
                  <i className="bx bx-x text-xl"></i>
                </button>
              </div>

              <div className="bg-neutral-50 rounded-md p-4 border border-neutral-100 flex justify-between items-center text-sm">
                <div>
                  <span className="text-sm text-neutral-400 font-medium block">Plan Amount</span>
                  <span className="text-sm font-medium text-neutral-800">{selectedPlan?.name}</span>
                </div>
                <span className="text-sm font-medium text-neutral-900">₹{calculateTotalPrice().toLocaleString()}</span>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-1">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium text-sm rounded-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <i className="bx bx-x text-sm"></i>
                  <span className="whitespace-nowrap">Cancel & Review</span>
                </button>

                <button
                  onClick={async () => {
                    setShowPaymentModal(false);
                    setSubmitting(true);
                    await saveProject(true);
                  }}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <i className="bx bx-check-circle text-sm"></i>
                  <span className="whitespace-nowrap">Confirm & Create Project</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
