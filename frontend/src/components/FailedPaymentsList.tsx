import React from 'react';
import { AlertCircle, CreditCard, Smartphone, Globe, UserCheck } from 'lucide-react';
import { PaymentItem } from '../types';

interface FailedPaymentsListProps {
  payments: PaymentItem[];
}

export const FailedPaymentsList: React.FC<FailedPaymentsListProps> = ({ payments }) => {
  const failedOnly = payments.filter(p => p.status === 'failed');

  const getReasonBadge = (reason?: string) => {
    switch (reason) {
      case 'bank_decline':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Bank Decline</span>;
      case 'card_expired':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">Card Expired</span>;
      case 'network_timeout':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">Network Timeout</span>;
      case 'insufficient_funds':
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Insufficient Funds</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">Failed</span>;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'upi':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'card':
        return <CreditCard className="w-4 h-4 text-indigo-400" />;
      default:
        return <Globe className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-400" />
            <span>Failed Payment Transaction Telemetry</span>
          </h2>
          <p className="text-xs text-slate-400">
            Unresolved payment failures monitored by RazorGrowth AI agent ({failedOnly.length} items)
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Total Lost: ₹{failedOnly.reduce((acc, p) => acc + p.amount, 0).toLocaleString('en-IN')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Transaction ID</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">Failure Reason</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Eligibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {failedOnly.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/40 transition">
                <td className="py-3 px-4 font-mono text-slate-300">{p.id}</td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-white">{p.customer_name}</div>
                  <div className="text-slate-400 text-[11px]">{p.customer_email}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-1.5 text-slate-300 uppercase font-mono">
                    {getMethodIcon(p.payment_method)}
                    <span>{p.payment_method}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {getReasonBadge(p.failure_reason)}
                </td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  ₹{p.amount.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px] font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <UserCheck className="w-3 h-3" />
                    <span>Eligible</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
