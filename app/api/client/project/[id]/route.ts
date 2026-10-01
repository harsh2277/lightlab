import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { generateClientToken } from '@/utils/clientLinkToken';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();

    // 1. Fetch project with plan details
    const { data: proj, error: projError } = await adminClient
      .from('projects')
      .select('*, pricing_plans(*)')
      .eq('id', id)
      .maybeSingle();

    if (projError) {
      console.error('[client/project] Error fetching project:', projError);
      return NextResponse.json({ error: 'Failed to retrieve project' }, { status: 500 });
    }

    if (!proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Fetch architect profile if present
    let architectProfile = null;
    if (proj.architect_id) {
      const { data: arch } = await adminClient
        .from('profiles')
        .select('name, email')
        .eq('id', proj.architect_id)
        .maybeSingle();
      architectProfile = arch || null;
    }

    // 3. Fetch lighting preferences
    const { data: prefs } = await adminClient
      .from('project_lighting_preferences')
      .select('preference_name')
      .eq('project_id', id);

    // 4. Fetch deliverables and designer assets
    const { data: filesData } = await adminClient
      .from('project_files')
      .select('*, profiles:uploaded_by(role)')
      .eq('project_id', id);

    const deliverables = (filesData || []).filter(
      (f: any) =>
        f.category === 'deliverable' ||
        f.category?.startsWith('deliverable_') ||
        f.profiles?.role === 'designer'
    );

    // 5. Fetch past client feedback / approvals
    const { data: revs } = await adminClient
      .from('revision_requests')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    const feedbackEntries = (revs || []).filter((r: any) =>
      r.description?.includes('CLIENT')
    );

    // 6. Generate secure client token for submitting approval / revisions
    let token = '';
    try {
      token = generateClientToken(id);
    } catch (tokenErr) {
      console.warn('[client/project] Token generation error:', tokenErr);
    }

    return NextResponse.json({
      success: true,
      project: proj,
      architectProfile,
      preferences: prefs || [],
      deliverables,
      feedbackEntries,
      token,
    });
  } catch (err: any) {
    console.error('[client/project] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
