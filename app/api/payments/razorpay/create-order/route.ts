import { NextResponse } from 'next/server';
import { createClient as createCookieClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { rateLimit, clientKeyFrom } from '@/utils/rateLimit';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_ThPfSe1IqrzkCf';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '6DABlKvTLpi1aBOMWUeI8gyJ';

export async function POST(request: Request) {
  try {
    const rl = rateLimit(`razorpay-order:${clientKeyFrom(request)}`, 15, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many payment attempts. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString() } }
      );
    }

    if (!RAZORPAY_KEY_SECRET || !RAZORPAY_KEY_ID) {
      return NextResponse.json(
        { error: 'Payment gateway is not configured on the server (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET).' },
        { status: 500 }
      );
    }

    const cookieClient = await createCookieClient();
    const adminClient = getSupabaseAdmin();

    const { data: { user } } = await cookieClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.isNewProject) {
      const { pricingPlanId, selectedAddonIds, projectName } = body;
      if (!pricingPlanId) {
        return NextResponse.json({ error: 'pricingPlanId is required' }, { status: 400 });
      }

      // Fetch pricing plan
      const { data: plan } = await adminClient
        .from('pricing_plans')
        .select('*')
        .eq('id', pricingPlanId)
        .maybeSingle();

      let planPrice = 0;
      if (plan) {
        planPrice = Number(plan.base_price_per_sq_ft || plan.flat_price || 0);
      } else {
        const staticPrices: Record<string, number> = {
          essential: 4999,
          professional: 9999,
          premium: 24999,
        };
        planPrice = staticPrices[pricingPlanId] || 9999;
      }

      // Fetch addons if any
      let addonsPrice = 0;
      if (Array.isArray(selectedAddonIds) && selectedAddonIds.length > 0) {
        const { data: addons } = await adminClient
          .from('pricing_addons')
          .select('id, price')
          .in('id', selectedAddonIds);
        if (addons && addons.length > 0) {
          addonsPrice = addons.reduce((sum: number, a: any) => sum + Number(a.price || 0), 0);
        } else {
          const staticAddonPrices: Record<string, number> = {
            '3d_vis': 5000,
            'site_visit': 2500,
          };
          addonsPrice = selectedAddonIds.reduce((sum: number, id: string) => sum + (staticAddonPrices[id] || 0), 0);
        }
      }

      const subtotal = planPrice + addonsPrice;
      const grandTotal = Math.round(subtotal * 1.18);
      const amountInPaise = Math.round(grandTotal * 100);

      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `np_${user.id.replace(/-/g, '').slice(0, 15)}_${Date.now().toString(36)}`,
          notes: {
            userId: user.id,
            isNewProject: 'true',
            pricingPlanId,
            projectName: (projectName || 'New Project').slice(0, 30),
          },
        }),
      });

      const order = await res.json();
      if (!res.ok) {
        console.error('[razorpay/create-order] Razorpay API error:', order);
        return NextResponse.json({ error: order?.error?.description || 'Failed to create payment order' }, { status: 502 });
      }

      return NextResponse.json({ success: true, orderId: order.id, keyId: RAZORPAY_KEY_ID, amount: amountInPaise });
    }

    const { projectId, paymentId } = body;
    if (!projectId || !paymentId) {
      return NextResponse.json({ error: 'projectId and paymentId are required' }, { status: 400 });
    }

    // Verify the caller owns (is the architect on) this project
    const { data: project } = await adminClient
      .from('projects')
      .select('id, architect_id, project_name')
      .eq('id', projectId)
      .maybeSingle();

    if (!project || project.architect_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // The order amount is never trusted from the client — it is always read
    // from the pending payment row that was created (server/DB-side) when the
    // project/milestone was set up. This prevents a client from paying an
    // arbitrary (e.g. tampered, lower) amount for a real project/payment.
    const { data: payment } = await adminClient
      .from('payments')
      .select('id, project_id, amount, status')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment || payment.project_id !== projectId) {
      return NextResponse.json({ error: 'Payment record not found for this project' }, { status: 404 });
    }
    if (payment.status === 'completed') {
      return NextResponse.json({ error: 'This payment has already been completed' }, { status: 409 });
    }
    if (!payment.amount || Number(payment.amount) <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount on record' }, { status: 400 });
    }

    const amountInPaise = Math.round(Number(payment.amount) * 100);

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        // Razorpay caps `receipt` at 40 chars — a raw UUID + timestamp overflows that,
        // so use a short hash of the payment id (unique per payment) plus a compact timestamp.
        receipt: `${paymentId.replace(/-/g, '').slice(0, 20)}-${Date.now().toString(36)}`,
        notes: { projectId, userId: user.id, paymentId },
      }),
    });

    const order = await res.json();
    if (!res.ok) {
      console.error('[razorpay/create-order] Razorpay API error:', order);
      return NextResponse.json({ error: order?.error?.description || 'Failed to create payment order' }, { status: 502 });
    }

    return NextResponse.json({ success: true, orderId: order.id, keyId: RAZORPAY_KEY_ID, amount: amountInPaise });
  } catch (err: any) {
    console.error('[razorpay/create-order] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
