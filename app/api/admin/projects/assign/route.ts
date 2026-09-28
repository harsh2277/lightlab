import { createClient as createCookieClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { requireRole } from '@/utils/supabase/authorize';

const VALID_PROJECT_STATUSES = [
  'Submitted',
  'Payment Pending',
  'Under Review',
  'In Design',
  'Ready for Client Review',
  'Approved',
  'Revision Requested',
  'Closed',
];

export async function POST(request: Request) {
  try {
    const auth = await requireRole(['admin']);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { projectId, designerId, status } = await request.json();

    if (!projectId) {
      return Response.json({ error: 'Missing projectId' }, { status: 400 });
    }

    if (status && !VALID_PROJECT_STATUSES.includes(status)) {
      return Response.json({ error: `Invalid status. Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}` }, { status: 400 });
    }

    if (designerId) {
      const { data: designerProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', designerId)
        .maybeSingle();
      if (designerProfile?.role !== 'designer') {
        return Response.json({ error: 'designerId must belong to a designer account' }, { status: 400 });
      }
    }

    // Enforce "Payment Pending - do not process further"
    if (status && ['In Design', 'Ready for Client Review', 'Approved', 'Closed'].includes(status)) {
      const { data: currentProj } = await supabaseAdmin
        .from('projects')
        .select('payment_status')
        .eq('id', projectId)
        .maybeSingle();

      if (currentProj && currentProj.payment_status !== 'paid') {
        return Response.json(
          { error: 'Payment Pending - do not process further. Project payment must be verified before proceeding.' },
          { status: 400 }
        );
      }
    }

    const updateFields: any = {};
    if (status) updateFields.status = status;
    if (designerId) updateFields.assigned_designer_id = designerId;
    const { data: updatedProject, error: adminError } = await supabaseAdmin
      .from('projects')
      .update(updateFields)
      .eq('id', projectId)
      .select()
      .single();

    if (!adminError && updatedProject) {
      return Response.json({ success: true, project: updatedProject });
    }

    // Fallback: use authenticated cookie session (admin user's JWT can bypass RLS)
    console.warn('[assign] Admin client failed, trying cookie session:', adminError?.message);
    const supabaseCookie = await createCookieClient();
    const { data: cookieProject, error: cookieError } = await supabaseCookie
      .from('projects')
      .update(updateFields)
      .eq('id', projectId)
      .select()
      .single();

    if (cookieError) {
      console.error('[assign] Cookie session also failed:', cookieError);
      return Response.json(
        {
          success: false,
          error: cookieError.message || 'Failed to update project assignment.',
        },
        { status: 500 }
      );
    }

    return Response.json({ success: true, project: cookieProject });
  } catch (err: any) {
    console.error('Error in /api/admin/projects/assign:', err);
    return Response.json({ error: err.message || 'Failed to update project assignment' }, { status: 500 });
  }
}
