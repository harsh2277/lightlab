'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Portal from '@/components/ui/Portal';
import { Badge, ConfirmModal, useToast, SkeletonPricingPage } from '@/components/ui';

export default function AdminPricingManagement() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);

  // Additional Revenue Add-ons state (name + amount editable per add-on)
  const DEFAULT_ADDONS = [
    { id: 'default-3d', name: '3D Lighting Visualization', description: 'Photorealistic 3D rendering and false-color lux calculation spreads', price_label: '₹5,000+' },
    { id: 'default-site-visit', name: 'Site Visit & Consultation', description: 'On-site luminaire positioning & electrical team coordination', price_label: '₹2,500' },
  ];
  const [addons, setAddons] = useState<{ id: string; name: string; description?: string; price_label: string }[]>(DEFAULT_ADDONS);
  const [addonForm, setAddonForm] = useState<{ id: string; name: string; price_label: string }[]>(DEFAULT_ADDONS.map(({ id, name, price_label }) => ({ id, name, price_label })));
  const [showAddonModal, setShowAddonModal] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  // Form state
  const [newPlan, setNewPlan] = useState({
    name: '',
    sqft: '',
    basePrice: '',
    originalPrice: '',
    discount: '50% off',
    features: '',
    bottomFeatures: '',
    isPopular: false,
    isActive: true
  });

  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    sqft: '',
    basePrice: '',
    originalPrice: '',
    discount: '',
    features: '',
    bottomFeatures: '',
    isPopular: false,
    isActive: true
  });

  const defaultPlans = [
    {
      id: 'essential',
      name: 'Amplex Essential',
      sqft: 'UP TO 1,500 SQ.FT.',
      price: 4999,
      originalPrice: 10000,
      discount: '50% off',
      features: ['Lighting Layout', 'Fixture Suggestions'],
      bottomFeatures: ['1 Revision'],
      is_active: true
    },
    {
      id: 'professional',
      name: 'Amplex Professional',
      sqft: '1,501 - 5,000 SQ.FT.',
      price: 9999,
      originalPrice: 20000,
      discount: '50% off',
      popular: true,
      features: ['Lighting Layout', 'Fixture Suggestions', 'Lux Guidance'],
      bottomFeatures: ['2 Revisions'],
      is_active: true
    },
    {
      id: 'premium',
      name: 'Amplex Premium',
      sqft: '5,001 - 10,000 SQ.FT.',
      price: 24999,
      originalPrice: 50000,
      discount: '50% off',
      features: ['Detailed Lighting Layout', 'Lux Calculations'],
      bottomFeatures: ['3 Revisions', '2 Site Visits'],
      is_active: true
    },
    {
      id: 'enterprise',
      name: 'Amplex Enterprise',
      sqft: 'ABOVE 10,000 SQ.FT.',
      price: null,
      customQuote: true,
      features: ['Complete Lighting Design Support', 'Multiple Revisions', 'Dedicated Designer'],
      bottomFeatures: ['Site Visits as per requirements'],
      is_active: true
    }
  ];

  async function fetchPlans() {
    try {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('min_sq_ft', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const dbPlans = data.map((d: any) => {
          const defaultMatch = defaultPlans.find(dp => dp.name.toLowerCase() === d.name.toLowerCase());
          const priceNum = Number(d.base_price_per_sq_ft || d.flat_price || 0);

          const bottomFeatures = (Array.isArray(d.bottom_features) && d.bottom_features.length > 0)
            ? d.bottom_features
            : (defaultMatch?.bottomFeatures || ['1 Revision']);

          const featuresArr = (Array.isArray(d.features) && d.features.length > 0)
            ? d.features
            : (d.description
              ? d.description.split(',').map((s: string) => s.trim()).filter(Boolean)
              : (defaultMatch?.features || ['Lighting Layout']));

          const isCustomQuote = d.is_custom_quote || (priceNum === 0 && !d.flat_price) || d.base_price_per_sq_ft === null;

          return {
            id: d.id,
            name: d.name,
            sqft: d.sqft_label || defaultMatch?.sqft || (d.min_sq_ft ? `MIN ${Number(d.min_sq_ft).toLocaleString()} SQ.FT.` : 'CUSTOM AREA'),
            price: priceNum > 0 ? priceNum : (defaultMatch?.price || null),
            originalPrice: d.original_price ? Number(d.original_price) : (defaultMatch?.originalPrice || (priceNum > 0 ? priceNum * 2 : null)),
            discount: isCustomQuote ? undefined : (d.discount_tag || defaultMatch?.discount || '50% off'),
            popular: Boolean(d.is_popular),
            customQuote: isCustomQuote,
            features: featuresArr,
            bottomFeatures,
            is_active: d.is_active ?? true
          };
        });

        setPlans(dbPlans);
      } else {
        setPlans(defaultPlans);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setPlans(defaultPlans);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAddons() {
    try {
      const { data, error } = await supabase
        .from('pricing_addons')
        .select('id, name, description, price, price_label')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const loaded = data.map((a: any) => {
          const known = DEFAULT_ADDONS.find((d) => d.name === a.name || a.name.toLowerCase().includes(d.name.toLowerCase()));
          return {
            id: a.id,
            name: a.name,
            description: a.description || known?.description || 'Optional add-on service',
            price_label: a.price_label || `₹${Number(a.price || 0).toLocaleString('en-IN')}`,
          };
        });
        setAddons(loaded);
        setAddonForm(loaded.map((a: { id: string; name: string; price_label: string }) => ({ id: a.id, name: a.name, price_label: a.price_label })));
      }
    } catch (err) {
      // Table may not exist yet — keep hardcoded defaults
      console.warn('pricing_addons table not found, using defaults');
    }
  }

  useEffect(() => {
    fetchPlans();
    fetchAddons();
  }, []);

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();

    const planName = newPlan.name.trim();
    if (!planName) return;

    // Client-side check for duplicate name
    const isDuplicate = plans.some(p => p.name.toLowerCase() === planName.toLowerCase());
    if (isDuplicate) {
      toastError(`A pricing plan named "${planName}" already exists. Please choose a unique name.`);
      return;
    }

    setSubmitting(true);

    try {
      const featuresArr = newPlan.features.split(',').map(s => s.trim()).filter(Boolean);
      const bottomFeaturesArr = newPlan.bottomFeatures.split(',').map(s => s.trim()).filter(Boolean);
      const planPrice = newPlan.basePrice ? parseFloat(newPlan.basePrice) : 0;
      const originalPrice = newPlan.originalPrice ? parseFloat(newPlan.originalPrice) : null;

      if (newPlan.isPopular) {
        // Ensure only ONE plan is popular at a time: unmark all other plans
        await supabase
          .from('pricing_plans')
          .update({ is_popular: false })
          .neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error: insertError } = await supabase
        .from('pricing_plans')
        .insert({
          name: planName,
          description: featuresArr.join(', '),
          base_price_per_sq_ft: planPrice,
          flat_price: planPrice,
          original_price: originalPrice,
          sqft_label: newPlan.sqft.trim() || null,
          discount_tag: newPlan.discount.trim() || null,
          features: featuresArr,
          bottom_features: bottomFeaturesArr,
          min_sq_ft: 1000,
          is_popular: newPlan.isPopular,
          is_active: newPlan.isActive
        });

      if (insertError) throw insertError;

      toastSuccess(`Pricing Tier "${planName}" created successfully!`);
      setShowAddModal(false);
      setNewPlan({ name: '', sqft: '', basePrice: '', originalPrice: '', discount: '50% off', features: '', bottomFeatures: '', isPopular: false, isActive: true });
      fetchPlans();
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('pricing_plans_name_key')) {
        toastError(`A pricing plan named "${planName}" already exists in the database. Please enter a unique name.`);
      } else {
        toastError(err.message || 'Failed to add plan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSubmitting(true);

    const planName = editForm.name.trim();

    try {
      const featuresArr = editForm.features.split(',').map(s => s.trim()).filter(Boolean);
      const bottomFeaturesArr = editForm.bottomFeatures.split(',').map(s => s.trim()).filter(Boolean);
      const updatedPrice = editForm.basePrice !== '' ? parseFloat(editForm.basePrice) : 0;
      const originalPrice = editForm.originalPrice !== '' ? parseFloat(editForm.originalPrice) : null;

      if (editForm.isPopular) {
        // Ensure only ONE plan is popular at a time: unmark all other plans
        await supabase
          .from('pricing_plans')
          .update({ is_popular: false })
          .neq('id', editingPlan.id);
      }

      const { error: updateError } = await supabase
        .from('pricing_plans')
        .update({
          name: planName,
          description: featuresArr.join(', '),
          base_price_per_sq_ft: updatedPrice,
          flat_price: updatedPrice,
          original_price: originalPrice,
          sqft_label: editForm.sqft.trim() || null,
          discount_tag: editForm.discount.trim() || null,
          features: featuresArr,
          bottom_features: bottomFeaturesArr,
          is_popular: editForm.isPopular,
          is_active: editForm.isActive
        })
        .eq('id', editingPlan.id);

      if (updateError) throw updateError;

      toastSuccess(`Plan "${planName}" updated successfully!`);
      setShowEditModal(false);
      fetchPlans();
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('pricing_plans_name_key')) {
        toastError(`A pricing plan named "${planName}" already exists in the database. Please enter a unique name.`);
      } else {
        toastError(err.message || 'Failed to update plan');
      }
    } finally {
      setSubmitting(false);
    }
  };


  const handleDeletePlan = async (id: string, name: string) => {
    try {
      await supabase
        .from('pricing_plans')
        .delete()
        .eq('id', id);

      setPlans(prev => prev.filter(p => p.id !== id));
      toastSuccess(`Pricing plan "${name}" removed successfully!`);
    } catch (err: any) {
      toastError(err.message || 'Failed to delete plan');
    } finally {
      setPlanToDelete(null);
    }
  };

  const handleSaveAddons = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isDefaultId = (id: string) => id.startsWith('default-');

      const parsePrice = (label: string) => {
        const cleaned = label.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };

      // Rows that already exist in the DB — update in place by id so renames don't create duplicates.
      const existingRows = addonForm
        .filter((a) => !isDefaultId(a.id))
        .map(({ id, name, price_label }) => ({
          id,
          name,
          price_label,
          price: parsePrice(price_label),
          is_active: true
        }));

      // Rows still on their placeholder id (table row never existed / table not seeded yet) — insert fresh.
      const newRows = addonForm
        .filter((a) => isDefaultId(a.id))
        .map(({ name, price_label }) => ({
          name,
          price_label,
          price: parsePrice(price_label),
          is_active: true
        }));

      if (existingRows.length > 0) {
        const { error } = await supabase.from('pricing_addons').upsert(existingRows, { onConflict: 'id' });
        if (error) throw error;
      }
      if (newRows.length > 0) {
        const { error } = await supabase.from('pricing_addons').insert(newRows);
        if (error) throw error;
      }

      setAddons((prev) =>
        addonForm.map((f) => ({ ...f, description: prev.find((a) => a.id === f.id)?.description }))
      );
      toastSuccess('Add-on services updated successfully!');
      await fetchAddons();
    } catch (err: any) {
      toastError(err.message || 'Failed to update add-on services.');
    } finally {
      setShowAddonModal(false);
    }
  };

  const startEditing = (plan: any) => {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      sqft: plan.sqft || '',
      basePrice: plan.price !== null && plan.price !== undefined ? plan.price.toString() : '',
      originalPrice: plan.originalPrice !== null && plan.originalPrice !== undefined ? plan.originalPrice.toString() : '',
      discount: plan.discount || '',
      features: plan.features ? plan.features.join(', ') : '',
      bottomFeatures: plan.bottomFeatures ? plan.bottomFeatures.join(', ') : '',
      isPopular: Boolean(plan.popular),
      isActive: plan.is_active !== undefined ? plan.is_active : true
    });
    setShowEditModal(true);
  };

  if (loading) return <SkeletonPricingPage />;

  return (
    <div className="space-y-6 font-sans">

      {/* Clean Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/80">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">Pricing & Packages</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Control pricing plan defaults, flat project rates, and deliverable packages.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-semibold text-xs rounded-md transition-all cursor-pointer shadow-xs"
        >
          <i className="bx bx-plus text-sm mr-1.5"></i>
          <span>Add Plan Tier</span>
        </button>
      </div>

      {/* DYNAMIC CARD GRID MATCHING ALL DB PRICING PLANS */}
      <div className={`grid ${
        plans.length <= 1 ? 'grid-cols-1 max-w-md' :
        plans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl' :
        plans.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
        plans.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
      } gap-5 mt-6`}>
        {plans.map((p) => {
          return (
            <div
              key={p.id}
              className={`border rounded-md p-5 bg-white flex flex-col justify-between hover:border-neutral-300 transition-all duration-200 relative h-full ${
                p.popular ? 'border-amber-500 ring-1 ring-amber-500' : 'border-neutral-200'
              }`}
            >
              {p.popular && (
                <Badge variant="amber" styleType="solid" size="xs" className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-xs z-10 whitespace-nowrap">
                  Most Popular
                </Badge>
              )}

              <div className="flex flex-col flex-1">
                <div className="flex justify-between items-center gap-1 min-h-[22px]">
                  <span className="text-[11px] font-semibold text-neutral-400">{p.sqft}</span>
                  {p.discount ? (
                    <Badge variant="warning" styleType="soft" size="xs">
                      {p.discount}
                    </Badge>
                  ) : <span className="h-5" />}
                </div>

                <h3 className="text-base font-semibold text-neutral-900 leading-snug mt-2 min-h-[24px] flex items-center">{p.name}</h3>

                <div className="pt-3 mt-3 border-t border-neutral-100 min-h-[58px] flex flex-col justify-center">
                  <span className="text-xs text-neutral-400 font-medium block">Rate</span>
                  {p.customQuote || p.price === null ? (
                    <span className="text-xl font-bold text-neutral-900 leading-tight">Custom Quote</span>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-neutral-900 leading-none">₹{Number(p.price || 0).toLocaleString('en-IN')}</span>
                        <span className="text-xs text-neutral-400 font-medium"> / flat</span>
                      </div>
                      {p.originalPrice && (
                        <span className="text-xs text-neutral-400 line-through block font-medium">₹{Number(p.originalPrice).toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  )}
                </div>

                <ul className="space-y-2.5 pt-3 mt-3 border-t border-neutral-100 flex-1">
                  {p.features?.map((f: string, i: number) => (
                    <li key={i} className="text-xs text-neutral-600 font-medium flex items-start space-x-1.5">
                      <i className="bx bx-check text-amber-600 text-sm mt-0.5 flex-shrink-0"></i>
                      <span className="leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bottom section (Revisions & Site Visits + Actions) */}
              <div className="mt-4 pt-3 border-t border-neutral-100">
                <div className="min-h-[44px] flex flex-col justify-center">
                  {p.bottomFeatures && p.bottomFeatures.length > 0 ? (
                    p.bottomFeatures.map((bf: string, idx: number) => (
                      <div key={idx} className="text-xs text-neutral-600 font-medium flex items-center justify-start gap-1.5 py-0.5">
                        <i className="bx bx-sync text-neutral-400 text-sm flex-shrink-0"></i>
                        <span>{bf}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Standard deliverables</span>
                  )}
                </div>

                {/* Admin Action Buttons */}
                <div className="pt-3 mt-2 border-t border-neutral-100 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => startEditing(p)}
                    className="py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 font-semibold text-xs rounded-md border border-neutral-200 transition-all cursor-pointer flex items-center justify-center space-x-1 active:scale-[0.98]"
                    aria-label={`Edit ${p.name}`}
                  >
                    <i className="bx bx-edit text-sm"></i>
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      setPlanToDelete({ id: p.id, name: p.name });
                      setShowDeleteConfirm(true);
                    }}
                    className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-md border border-rose-200 transition-all cursor-pointer flex items-center justify-center space-x-1 active:scale-[0.98]"
                    aria-label={`Delete ${p.name}`}
                  >
                    <i className="bx bx-trash text-sm"></i>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADDITIONAL REVENUE OPPORTUNITIES SECTION */}
      <div className="bg-white border border-neutral-200 rounded-md p-6 space-y-4 font-sans mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-100">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">Additional Revenue Opportunities & Services</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Optional add-on services selectable by architects during project creation.</p>
          </div>
          <button
            onClick={() => setShowAddonModal(true)}
            className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-md border border-neutral-200 transition-all flex items-center space-x-1.5 cursor-pointer w-fit"
          >
            <i className="bx bx-edit text-sm"></i>
            <span>Edit Add-on Services</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addons.map((addon) => (
            <div key={addon.id} className="border border-neutral-200 rounded-md p-4 bg-neutral-50/50 flex items-center justify-between min-h-[72px]">
              <div className="space-y-0.5 min-w-0 pr-4">
                <span className="text-sm font-semibold text-neutral-900 block truncate">{addon.name}</span>
                <span className="text-xs text-neutral-500 block">{addon.description || 'Optional add-on service'}</span>
              </div>
              <div className="text-right shrink-0 ml-auto">
                <span className="text-base font-bold text-amber-600 font-sans block">{addon.price_label}</span>
                <span className="text-[10px] text-neutral-400 font-medium block">Add-on</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EDIT ADD-ON RATES MODAL */}
      {showAddonModal && (
        <Portal>
          <div className="fixed inset-0 bg-neutral-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans transition-all duration-300">
            <div className="bg-white border border-neutral-200 rounded-md max-w-md w-full p-6 space-y-4 animate-fade-in relative shadow-lg">
              <button
                onClick={() => setShowAddonModal(false)}
                className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <i className="bx bx-x text-2xl"></i>
              </button>

              <div>
                <h3 className="text-base font-semibold text-neutral-900">Edit Additional Services</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Update the name and display fee for each optional add-on service.</p>
              </div>

              <form onSubmit={handleSaveAddons} className="space-y-4">
                {addonForm.map((addon, idx) => (
                  <div key={addon.id} className="grid grid-cols-2 gap-3 pb-4 border-b border-neutral-100 last:border-b-0 last:pb-0">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Service Name</label>
                      <input
                        type="text"
                        required
                        value={addon.name}
                        onChange={(e) =>
                          setAddonForm((prev) => prev.map((a, i) => (i === idx ? { ...a, name: e.target.value } : a)))
                        }
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Amount</label>
                      <input
                        type="text"
                        required
                        value={addon.price_label}
                        onChange={(e) =>
                          setAddonForm((prev) => prev.map((a, i) => (i === idx ? { ...a, price_label: e.target.value } : a)))
                        }
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddonModal(false)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* CREATE PLAN MODAL */}
      {showAddModal && (
        <Portal>
          <div className="fixed inset-0 bg-neutral-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans transition-all duration-300">
            <div className="bg-white border border-neutral-200 rounded-md max-w-md w-full p-6 space-y-4 animate-fade-in relative shadow-lg">
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <i className="bx bx-x text-2xl"></i>
              </button>

              <div>
                <h3 className="text-base font-semibold text-neutral-900">Create Pricing Plan</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Introduce a new design package or rate configuration.</p>
              </div>

              <form onSubmit={handleAddPlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={newPlan.name}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Amplex Commercial Deluxe"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Area Range (sq ft) *</label>
                    <input
                      type="text"
                      required
                      value={newPlan.sqft}
                      onChange={(e) => setNewPlan(prev => ({ ...prev, sqft: e.target.value }))}
                      placeholder="e.g. 10,001 - 15,000 SQ.FT."
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Discount Tag</label>
                    <input
                      type="text"
                      value={newPlan.discount}
                      onChange={(e) => setNewPlan(prev => ({ ...prev, discount: e.target.value }))}
                      placeholder="e.g. 50% off"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Offer Rate (₹) *</label>
                    <input
                      type="number"
                      step="1"
                      value={newPlan.basePrice}
                      onChange={(e) => setNewPlan(prev => ({ ...prev, basePrice: e.target.value }))}
                      placeholder="e.g. 4999 (Leave empty for Custom Quote)"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Regular Rate (₹)</label>
                    <input
                      type="number"
                      step="1"
                      value={newPlan.originalPrice}
                      onChange={(e) => setNewPlan(prev => ({ ...prev, originalPrice: e.target.value }))}
                      placeholder="e.g. 10000"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Features (Checkmark list - comma separated)</label>
                  <input
                    type="text"
                    value={newPlan.features}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, features: e.target.value }))}
                    placeholder="e.g. Lighting Layout, Fixture Suggestions, Lux Guidance"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Revisions & Site Visits (Bottom list - comma separated)</label>
                  <input
                    type="text"
                    value={newPlan.bottomFeatures}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, bottomFeatures: e.target.value }))}
                    placeholder="e.g. 3 Revisions, 2 Site Visits"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                {/* Most Popular Toggle */}
                <div className="flex items-center justify-between p-3 bg-amber-50/60 border border-amber-200/80 rounded-md">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-900 cursor-pointer">
                      Set as "Most Popular"
                    </label>
                    <p className="text-[11px] text-neutral-500">
                      Only one plan can be Most Popular at a time.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPlan.isPopular}
                      onChange={(e) => setNewPlan(prev => ({ ...prev, isPopular: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Plan Tier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* EDIT PLAN MODAL */}
      {showEditModal && editingPlan && (
        <Portal>
          <div className="fixed inset-0 bg-neutral-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans transition-all duration-300">
            <div className="bg-white border border-neutral-200 rounded-md max-w-md w-full p-6 space-y-4 animate-fade-in relative shadow-lg">
              <button
                onClick={() => setShowEditModal(false)}
                className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <i className="bx bx-x text-2xl"></i>
              </button>

              <div>
                <h3 className="text-base font-semibold text-neutral-900">Edit Pricing Plan & Options</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Update rate, features, revisions, and site visits options for {editingPlan.name}</p>
              </div>

              <form onSubmit={handleUpdatePlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Area Range Label</label>
                    <input
                      type="text"
                      value={editForm.sqft}
                      onChange={(e) => setEditForm(prev => ({ ...prev, sqft: e.target.value }))}
                      placeholder="e.g. UP TO 1,500 SQ.FT."
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Discount Tag</label>
                    <input
                      type="text"
                      value={editForm.discount}
                      onChange={(e) => setEditForm(prev => ({ ...prev, discount: e.target.value }))}
                      placeholder="e.g. 50% off"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Offer Price (₹)</label>
                    <input
                      type="number"
                      step="1"
                      value={editForm.basePrice}
                      onChange={(e) => setEditForm(prev => ({ ...prev, basePrice: e.target.value }))}
                      placeholder="e.g. 4999 (Leave empty for Custom Quote)"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Regular Rate (₹)</label>
                    <input
                      type="number"
                      step="1"
                      value={editForm.originalPrice}
                      onChange={(e) => setEditForm(prev => ({ ...prev, originalPrice: e.target.value }))}
                      placeholder="e.g. 10000"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Checkmark Features (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.features}
                    onChange={(e) => setEditForm(prev => ({ ...prev, features: e.target.value }))}
                    placeholder="e.g. Lighting Layout, Fixture Suggestions, Lux Guidance"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Revisions & Site Visits Options (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.bottomFeatures}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bottomFeatures: e.target.value }))}
                    placeholder="e.g. 3 Revisions, 2 Site Visits"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                {/* Most Popular Toggle */}
                <div className="flex items-center justify-between p-3 bg-amber-50/60 border border-amber-200/80 rounded-md">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-900 cursor-pointer">
                      Set as "Most Popular"
                    </label>
                    <p className="text-[11px] text-neutral-500">
                      Only one plan can be Most Popular at a time.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isPopular}
                      onChange={(e) => setEditForm(prev => ({ ...prev, isPopular: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Pricing Plan"
        message={`Are you sure you want to delete "${planToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Plan"
        variant="danger"
        onConfirm={() => {
          if (planToDelete) handleDeletePlan(planToDelete.id, planToDelete.name);
        }}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPlanToDelete(null);
        }}
      />
    </div>
  );
}
