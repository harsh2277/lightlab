import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createCookieClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_ThPfSe1IqrzkCf';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '6DABlKvTLpi1aBOMWUeI8gyJ';

// projectPaymentKind identifies which server-side state transition to apply once
// the Razorpay signature has been verified:
// 'full'       — single full-amount payment, marks project payment_status='paid'
// 'milestone1' — 50% upfront deposit, marks project payment_status='partial'
// 'milestone2' — 50% final release payment, marks project payment_status='paid'
type PaymentKind = 'full' | 'milestone1' | 'milestone2';

export async function POST(request: Request) {
  try {
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

    const {
      projectId,
      paymentId,
      kind,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    }: {
      projectId: string;
      paymentId: string;
      kind: PaymentKind;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    } = await request.json();

    if (!projectId || !paymentId || !kind || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing required verification fields' }, { status: 400 });
    }

    // Verify caller owns this project
    const { data: project } = await adminClient
      .from('projects')
      .select('id, architect_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!project || project.architect_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load the specific payment row being settled. paymentId is now required
    // (no more "earliest pending payment" fallback) so a signature can never
    // be applied to the wrong milestone/payment row.
    const { data: payment } = await adminClient
      .from('payments')
      .select('id, project_id, amount, status')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment || payment.project_id !== projectId) {
      return NextResponse.json({ error: 'Payment record not found for this project' }, { status: 404 });
    }

    // Idempotency / replay guard: a payment can only be settled once.
    if (payment.status === 'completed') {
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    // Verify Razorpay HMAC signature: expected = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    // using a constant-time comparison to avoid a timing side-channel.
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const providedBuf = Buffer.from(razorpay_signature, 'hex');
    const signatureValid =
      expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!signatureValid) {
      console.error('[razorpay/verify] Signature mismatch for project', projectId);
      return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
    }

    // Reconcile the amount actually charged (via the Razorpay order) against
    // what this payment row expects, so a signature obtained for a
    // lower-value order can never be used to settle a higher-value payment.
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
      },
    });
    const order = await orderRes.json();
    const expectedPaise = Math.round(Number(payment.amount) * 100);

    const isNewProjectOrder = order.notes?.isNewProject === 'true';
    const notesMatch = isNewProjectOrder
      ? order.notes?.userId === user.id
      : (order.notes?.projectId === projectId && order.notes?.paymentId === paymentId);

    if (!orderRes.ok || !notesMatch || order.amount !== expectedPaise) {
      console.error('[razorpay/verify] Order/amount mismatch for payment', paymentId, order);
      return NextResponse.json({ error: 'Payment amount could not be verified' }, { status: 400 });
    }

    // Everything checks out — apply the state transition server-side.
    const projectUpdate: Record<string, any> =
      kind === 'milestone1'
        ? { payment_status: 'partial', status: 'Under Review' }
        : { payment_status: 'paid', status: 'Under Review' };

    await adminClient.from('projects').update(projectUpdate).eq('id', projectId);

    await adminClient
      .from('payments')
      .update({ status: 'completed', transaction_id: razorpay_payment_id })
      .eq('id', paymentId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[razorpay/verify] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
