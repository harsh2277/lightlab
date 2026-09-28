'use client';

import { useEffect } from 'react';
import Portal from './Portal';

interface InvoiceModalProps {
  invoice: any;
  onClose: () => void;
  onPayInvoice?: (invoice: any) => void;
}

const STATUS_TEXT_COLOR: Record<string, string> = {
  completed: 'text-emerald-600',
  pending: 'text-amber-600',
  failed: 'text-rose-600',
};

export default function InvoiceModal({ invoice, onClose, onPayInvoice }: InvoiceModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const statusKey = (invoice.status || 'pending').toLowerCase();
  const statusLabel = statusKey === 'completed' ? 'Paid' : statusKey.charAt(0).toUpperCase() + statusKey.slice(1);
  const statusColor = STATUS_TEXT_COLOR[statusKey] || STATUS_TEXT_COLOR.pending;

  const issueDate = new Date(invoice.created_at);
  const dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);
  const rate = Number(invoice.projects?.pricing_plans?.base_price_per_sq_ft || 0);
  const area = Number(invoice.projects?.area_sq_ft || 0);

  return (
    <Portal>
      {/* Print media overrides — scoped so only the invoice document prints, at clean page margins. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body > div:not(.print-modal-backdrop), aside, header, nav, .print-hide { display: none !important; }
          body, html { background: white !important; margin: 0 !important; height: auto !important; overflow: visible !important; }
          .print-modal-backdrop { position: static !important; background: transparent !important; backdrop-filter: none !important; padding: 0 !important; display: block !important; }
          .print-invoice-card { border: none !important; box-shadow: none !important; max-width: 100% !important; width: 100% !important; margin: 0 !important; }
          .print-invoice-area { max-height: none !important; overflow: visible !important; }
        }
      `}</style>

      <div
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans print-modal-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-modal-title"
          className="bg-white border border-neutral-200 rounded-lg max-w-2xl w-full overflow-hidden shadow-xl print-invoice-card"
        >
          {/* Action bar */}
          <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-200 flex justify-between items-center print-hide">
            <span id="invoice-modal-title" className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Invoice {invoice.invoice_number}
            </span>
            <div className="flex items-center gap-2">
              {statusKey === 'pending' && onPayInvoice && (
                <button
                  onClick={() => onPayInvoice(invoice)}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-md transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <i className="bx bx-credit-card text-sm"></i>
                  <span>Pay Invoice</span>
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs rounded-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <i className="bx bx-printer text-sm"></i>
                <span>Print / Download PDF</span>
              </button>
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium text-xs rounded-md transition-all cursor-pointer active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>

          {/* Printable invoice document */}
          <div className="max-h-[85vh] overflow-y-auto print-invoice-area">
            <div className="p-8 sm:p-10">
              {/* Letterhead */}
              <div className="flex items-start justify-between pb-6 border-b-2 border-neutral-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 flex items-center justify-center shrink-0">
                    <img src="/new-logo.png" alt="Lightmaps Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 text-sm tracking-tight block leading-tight">Lightmaps</span>
                    <span className="text-[11px] text-neutral-450 font-medium block leading-tight">Design Studio</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-900 leading-none">INVOICE</h1>
                  <p className="text-xs text-neutral-450 font-medium mt-1">{invoice.invoice_number}</p>
                  <span className={`block mt-1.5 text-xs font-bold uppercase tracking-wide ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>
              </div>

              {/* Bill-to / metadata */}
              <div className="grid grid-cols-2 gap-8 pt-6">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">Billed To</span>
                  <p className="font-semibold text-neutral-900 text-sm">{invoice.projects?.client_name || 'Client Name'}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{invoice.projects?.project_name || 'Project Name'}</p>
                  <p className="text-xs text-neutral-500">{invoice.projects?.site_location || 'Site Location'}</p>
                </div>
                <div className="text-right">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-neutral-400 font-medium">Date Issued</span>
                    <span className="text-neutral-800 font-semibold">
                      {issueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-neutral-400 font-medium">Due Date</span>
                    <span className="text-neutral-800 font-semibold">
                      {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="mt-8">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-400 font-bold uppercase tracking-wide">
                      <th className="pb-2.5 font-bold">Description</th>
                      <th className="pb-2.5 font-bold text-right">Rate</th>
                      <th className="pb-2.5 font-bold text-right">Qty</th>
                      <th className="pb-2.5 font-bold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-700">
                    <tr className="border-b border-neutral-100">
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-neutral-900 text-sm">{invoice.projects?.pricing_plans?.name || 'Onboarding Package Fee'}</p>
                        <p className="text-[11px] text-neutral-450 mt-0.5">Custom lighting layouts & lux simulation configuration</p>
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap text-neutral-600">₹{rate.toFixed(2)}/sq ft</td>
                      <td className="py-3.5 text-right whitespace-nowrap text-neutral-600">{area.toLocaleString()} sq ft</td>
                      <td className="py-3.5 text-right whitespace-nowrap font-semibold text-neutral-900">₹{Number(invoice.amount).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end mt-6">
                <div className="w-56">
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-neutral-450">Subtotal</span>
                    <span className="text-neutral-700">₹{Number(invoice.amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-neutral-450">Tax (0%)</span>
                    <span className="text-neutral-700">₹0.00</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 mt-1 border-t border-neutral-200">
                    <span className="font-semibold text-neutral-900">Total Due</span>
                    <span className="font-semibold text-neutral-900">₹{Number(invoice.amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-10 pt-6 border-t border-neutral-200 flex items-start justify-between gap-8">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">Payment Info</span>
                  <div className="text-xs text-neutral-500 space-y-0.5">
                    <p><span className="text-neutral-400">Bank:</span> HDFC Bank</p>
                    <p><span className="text-neutral-400">Account Name:</span> LightMap Design Studio</p>
                    <p><span className="text-neutral-400">Account No.:</span> 5020 0012 3456 78</p>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-400 text-right max-w-[180px]">
                  Thank you for your business. Payment is due within 15 days of the issue date.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
