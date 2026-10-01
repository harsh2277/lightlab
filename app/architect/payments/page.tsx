'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import LayoutToggle from '@/components/ui/LayoutToggle';
import SearchInput from '@/components/ui/SearchInput';
import { StatusBadge, SkeletonPaymentsPage, InvoiceModal, useToast } from '@/components/ui';

export default function ArchitectPaymentsPage() {
  const supabase = createClient();
  const { success: toastSuccess, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/payments');
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Dynamic load Razorpay checkout script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    fetchPayments();

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePayInvoice = async (pay: any) => {
    if (!pay.project_id || !pay.id) {
      toastError('Invoice details are incomplete for payment processing.');
      return;
    }
    setPayingInvoiceId(pay.id);
    try {
      const orderRes = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pay.project_id, paymentId: pay.id }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.orderId) {
        throw new Error(orderData.error || 'Failed to initialize payment gateway.');
      }

      const logoUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/new-logo.png`
        : '/new-logo.png';

      const options = {
        key: orderData.keyId,
        order_id: orderData.orderId,
        amount: orderData.amount,
        currency: "INR",
        name: "Lightmaps",
        description: `Payment for Invoice #${pay.invoice_number}`,
        image: logoUrl,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: pay.project_id,
                paymentId: pay.id,
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
            toastSuccess('Payment successful! Invoice has been settled.');
            fetchPayments();
            if (selectedInvoice && selectedInvoice.id === pay.id) {
              setSelectedInvoice((prev: any) => ({ ...prev, status: 'completed' }));
            }
          } catch (err: any) {
            toastError(err.message || 'Payment verification failed.');
          } finally {
            setPayingInvoiceId(null);
          }
        },
        modal: {
          ondismiss: function () {
            setPayingInvoiceId(null);
          }
        },
        theme: {
          color: "#f59e0b"
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      toastError(err.message || 'Error opening payment gateway.');
      setPayingInvoiceId(null);
    }
  };

  if (loading) {
    return <SkeletonPaymentsPage />;
  }

  // Calculate audit totals
  const totalInvoiced = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const completedPayments = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingPayments = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0);

  const filteredPayments = payments.filter(pay => {
    const matchesSearch = (pay.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pay.projects?.project_name && pay.projects.project_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (pay.projects?.client_name && pay.projects.client_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6 relative font-sans">
      {/* Configuration Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100 print-hide">
        <div>
          <h2 className="text-xl font-medium text-neutral-900 tracking-tight">Financial Overview</h2>
          <p className="text-sm text-neutral-450 mt-0.5">Track design package invoices, complete billing settlements, and review invoice details.</p>
        </div>
      </div>

      {/* Key Audit Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print-hide">
        <div className="bg-white border border-neutral-200 rounded-md p-4 xl:p-5 flex items-center justify-between hover: hover:border-amber-500/35 transition-all duration-300">
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-medium text-neutral-450 block">Total Invoiced</span>
            <span className="text-2xl sm:text-3xl font-medium text-neutral-900 leading-none">₹{(totalInvoiced / 100000).toFixed(2)}L</span>
            <span className="text-[10px] text-neutral-400 block mt-1.5 truncate">Sum of all billing events</span>
          </div>
          <div className="w-10 h-10 xl:w-12 xl:h-12 bg-neutral-50 rounded-md flex items-center justify-center text-neutral-600 border border-neutral-200 shrink-0">
            <i className="bx bx-receipt text-lg xl:text-xl"></i>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-md p-4 xl:p-5 flex items-center justify-between hover: hover:border-amber-500/35 transition-all duration-300">
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-medium text-neutral-455 block">Settled</span>
            <span className="text-2xl sm:text-3xl font-medium text-neutral-900 leading-none">₹{(completedPayments / 100000).toFixed(2)}L</span>
            <span className="text-[10px] text-neutral-400 block mt-1.5 truncate">Successfully completed settlements</span>
          </div>
          <div className="w-10 h-10 xl:w-12 xl:h-12 bg-emerald-50 rounded-md flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
            <i className="bx bx-badge-check text-lg xl:text-xl"></i>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white border border-neutral-200 rounded-md p-4 xl:p-5 flex items-center justify-between hover: hover:border-amber-500/35 transition-all duration-300">
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-medium text-neutral-455 block">Outstanding</span>
            <span className="text-2xl sm:text-3xl font-medium text-neutral-900 leading-none">₹{(pendingPayments / 100000).toFixed(2)}L</span>
            <span className="text-[10px] text-neutral-400 block mt-1.5 truncate">Invoices waiting for client action</span>
          </div>
          <div className="w-10 h-10 xl:w-12 xl:h-12 bg-amber-50 rounded-md flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
            <i className="bx bx-time-five text-lg xl:text-xl"></i>
          </div>
        </div>
      </div>

      {/* Transaction Logs Container */}
      <div className="space-y-4 print-hide">
        {/* Interactive controls bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search invoices, projects, representatives..."
          />

          {/* View Layout Toggle */}
          <LayoutToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* List/Table Render Area */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPayments.map((pay) => (
              <div
                key={pay.id}
                className="border border-neutral-200 hover:border-neutral-300 rounded-md p-6 bg-white flex flex-col justify-between space-y-4 hover: transition-all duration-300 group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-neutral-400">
                      {pay.invoice_number}
                    </span>
                    <StatusBadge status={pay.status} type="payment" />
                  </div>
                  <h3 className="text-sm font-medium text-neutral-900 group-hover:text-amber-600 transition-colors line-clamp-1">
                    {pay.projects?.project_name || 'Individual Project'}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">Client: {pay.projects?.client_name || 'Unassigned'}</p>
                </div>

                <div className="pt-4 border-t border-neutral-100 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-medium text-neutral-500">Invoiced Amount</span>
                    <span className="text-base font-medium text-neutral-800">₹{Number(pay.amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 gap-2">
                    <span className="text-xs text-neutral-450 font-medium">
                      {new Date(pay.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {pay.status === 'pending' && (
                        <button
                          onClick={() => handlePayInvoice(pay)}
                          disabled={payingInvoiceId === pay.id}
                          className="inline-flex items-center px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-all cursor-pointer text-xs font-semibold shadow-xs active:scale-[0.98] disabled:opacity-50"
                        >
                          <i className="bx bx-credit-card text-sm mr-1"></i>
                          <span>{payingInvoiceId === pay.id ? 'Loading...' : 'Pay Now'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedInvoice(pay)}
                        className="inline-flex items-center px-3 py-1.5 hover:bg-neutral-50 text-neutral-600 hover:text-amber-600 border border-neutral-200 rounded-md transition-all cursor-pointer text-xs font-medium active:scale-[0.98]"
                        title="View Detailed Invoice"
                      >
                        <i className="bx bx-receipt text-sm mr-1"></i>
                        <span>Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-md bg-white">
            <table className="w-full text-left border-collapse text-sm min-w-[700px] md:min-w-0 bg-white">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-medium text-xs">
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Invoice ID</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Project Scope</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Client Name</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Amount</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Settlement</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {filteredPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-sm text-neutral-900 font-medium">
                      {pay.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-900 font-medium">
                      {pay.projects?.project_name || 'Individual Project'}
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-500 text-sm font-medium">
                      {pay.projects?.client_name || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-550 text-sm">
                      ₹{Number(pay.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <StatusBadge status={pay.status} type="payment" />
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {pay.status === 'pending' && (
                          <button
                            onClick={() => handlePayInvoice(pay)}
                            disabled={payingInvoiceId === pay.id}
                            className="inline-flex items-center px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-md transition-all cursor-pointer text-xs shadow-xs active:scale-[0.98] disabled:opacity-50"
                          >
                            <i className="bx bx-credit-card text-sm mr-1"></i>
                            <span>{payingInvoiceId === pay.id ? 'Loading...' : 'Pay Now'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedInvoice(pay)}
                          className="inline-flex items-center px-3 py-1.5 hover:bg-neutral-50 text-neutral-600 hover:text-amber-600 border border-neutral-200 rounded-md transition-all cursor-pointer text-xs font-medium active:scale-[0.98]"
                          title="View Detailed Invoice"
                        >
                          <i className="bx bx-receipt text-sm mr-1.5"></i>
                          <span>View Details</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal (Printable) */}
      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPayInvoice={handlePayInvoice}
        />
      )}
    </div>
  );
}
