import { createClient as createCookieClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { requireUser, requireProjectAccess } from '@/utils/supabase/authorize';

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = getSupabaseAdmin();
    const { userId: effectiveUserId, role } = auth;
    let designerName = 'Designer';

    const { data: profile } = await adminClient
      .from('profiles')
      .select('name')
      .eq('id', effectiveUserId)
      .maybeSingle();
    if (profile?.name) designerName = profile.name;

    const selectCols = 'id, project_id_serial, project_name, client_name, area_sq_ft, payment_status, status, created_at, assigned_designer_id, deadline';

    let query = adminClient.from('projects').select(selectCols).order('created_at', { ascending: false });

    // Only admins may see every project; designers only see projects assigned to them
    if (role !== 'admin') {
      query = query.eq('assigned_designer_id', effectiveUserId);
    }

    const { data: projects, error } = await query;
    if (error) throw error;

    return Response.json({
      projects: projects || [],
      currentUserId: effectiveUserId,
      designerName,
    });
  } catch (err: any) {
    console.error('[designer/projects GET] Error:', err);
    return Response.json({ error: err.message || 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieClient = await createCookieClient();
    const adminClient = getSupabaseAdmin();

    const body = await request.json();
    const { projectId, status } = body;

    if (!projectId || !status) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const auth = await requireProjectAccess(projectId);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Enforce "Payment Pending - do not process further"
    const { data: currentProject } = await adminClient
      .from('projects')
      .select('payment_status')
      .eq('id', projectId)
      .maybeSingle();

    if (currentProject && currentProject.payment_status !== 'paid') {
      return Response.json(
        { error: 'Payment Pending - do not process further. Project payment must be verified before updating status.' },
        { status: 400 }
      );
    }

    let updatedProject: any = null;

    // Try cookieClient first (passes RLS with user JWT)
    const { data: cData } = await cookieClient
      .from('projects')
      .update({ status })
      .eq('id', projectId)
      .select()
      .maybeSingle();

    if (cData) {
      updatedProject = cData;
    } else {
      // Fallback to adminClient
      const { data: aData } = await adminClient
        .from('projects')
        .update({ status })
        .eq('id', projectId)
        .select()
        .maybeSingle();

      updatedProject = aData;
    }

    return Response.json({
      success: true,
      project: updatedProject || { id: projectId, status }
    });
  } catch (err: any) {
    console.error('[designer/projects POST] Error:', err);
    return Response.json({ error: err.message || 'Failed to update project status' }, { status: 500 });
  }
}
