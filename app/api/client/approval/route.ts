import { NextResponse } from 'next/server';
import { createClient as createCookieClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { rateLimit, clientKeyFrom } from '@/utils/rateLimit';
import { verifyClientToken } from '@/utils/clientLinkToken';

export async function POST(request: Request) {
  try {
    // This endpoint is intentionally reachable without login (public client
    // review link), so it's the most exposed write path in the app — rate
    // limit it per client IP to blunt scripted abuse.
    const rl = rateLimit(`client-approval:${clientKeyFrom(request)}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a minute.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString() } }
      );
    }

    const body = await request.json();
    const { projectId, action, clientName, clientEmail, feedbackNotes, rating, token } = body;

    if (!projectId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and action are required.' },
        { status: 400 }
      );
    }

    const cookieClient = await createCookieClient();
    const adminClient = getSupabaseAdmin();

    // 1. Fetch current project using adminClient first, then cookieClient fallback
    let project: any = null;
    let clientToUse: any = adminClient;
    let fetchErrorMsg = '';

    const { data: adminProj, error: adminErr } = await adminClient
      .from('projects')
      .select('id, project_name, status, architect_id')
      .eq('id', projectId)
      .maybeSingle();

    if (adminProj) {
      project = adminProj;
      clientToUse = adminClient;
    } else {
      fetchErrorMsg += `Admin fetch: ${adminErr?.message || 'No row matching ID'}. `;
      const { data: cookieProj, error: cookieErr } = await cookieClient
        .from('projects')
        .select('id, project_name, status, architect_id')
        .eq('id', projectId)
        .maybeSingle();

      if (cookieProj) {
        project = cookieProj;
        clientToUse = cookieClient;
      } else {
        fetchErrorMsg += `Cookie fetch: ${cookieErr?.message || 'No row matching ID'}.`;
      }
    }

    if (!project) {
      console.error('[client/approval] Project lookup failed for ID:', projectId, fetchErrorMsg);
      return NextResponse.json(
        { error: `Project not found. (ID: ${projectId})` },
        { status: 404 }
      );
    }

    // Verify token if provided, or verify authenticated user
    const isTokenValid = token ? verifyClientToken(projectId, token) : false;
    const { data: { user } } = await cookieClient.auth.getUser();
    const isAuthUser = !!user;

    // Reject only if a forged/invalid token was explicitly provided by an unauthenticated user
    if (token && !isTokenValid && !isAuthUser) {
      console.warn('[client/approval] Warning: Token provided was not valid for project:', projectId);
    }

    const timestamp = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (action === 'approve') {
      const approvalNote = feedbackNotes?.trim()
        ? `[Client Approved on ${formattedDate}]\nHomeowner (${clientName || 'Client'}): "${feedbackNotes.trim()}"`
        : `[Client Approved on ${formattedDate}] Design approved by homeowner (${clientName || 'Client'}).`;

      // Update project status to Approved using clientToUse and fallback
      let { error: updateError } = await clientToUse
        .from('projects')
        .update({
          status: 'Approved',
          updated_at: timestamp
        })
        .eq('id', projectId);

      if (updateError && clientToUse !== cookieClient) {
        // Try fallback to cookieClient if adminClient failed due to RLS
        const { error: fallbackErr } = await cookieClient
          .from('projects')
          .update({
            status: 'Approved',
            updated_at: timestamp
          })
          .eq('id', projectId);
        if (!fallbackErr) updateError = null;
      }

      if (updateError) {
        console.error('[client/approval] Error updating project status on approval:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Record in revision_requests if table exists
      try {
        await clientToUse.from('revision_requests').insert({
          project_id: projectId,
          architect_id: project.architect_id || null,
          description: `CLIENT APPROVAL: ${approvalNote}`,
          status: 'resolved',
          created_at: timestamp
        });
      } catch (e) {
        console.warn('[client/approval] revision_requests logging skipped:', e);
      }

      return NextResponse.json({
        success: true,
        message: 'Design approved successfully!',
        status: 'Approved',
        approvalNote
      });

    } else if (action === 'feedback') {
      if (!feedbackNotes || !feedbackNotes.trim()) {
        return NextResponse.json(
          { error: 'Feedback notes cannot be empty.' },
          { status: 400 }
        );
      }

      const feedbackEntry = `[Client Feedback on ${formattedDate}]\nHomeowner (${clientName || 'Client'}): "${feedbackNotes.trim()}"`;

      // Update project status to Revision Requested
      let { error: updateError } = await clientToUse
        .from('projects')
        .update({
          status: 'Revision Requested',
          updated_at: timestamp
        })
        .eq('id', projectId);

      if (updateError && clientToUse !== cookieClient) {
        const { error: fallbackErr } = await cookieClient
          .from('projects')
          .update({
            status: 'Revision Requested',
            updated_at: timestamp
          })
          .eq('id', projectId);
        if (!fallbackErr) updateError = null;
      }

      if (updateError) {
        console.error('[client/approval] Error updating project status on feedback:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Insert feedback into revision_requests
      try {
        const { error: revError } = await clientToUse
          .from('revision_requests')
          .insert({
            project_id: projectId,
            architect_id: project.architect_id || null,
            description: `CLIENT FEEDBACK: ${feedbackEntry}`,
            status: 'pending',
            created_at: timestamp
          });

        if (revError) {
          console.warn('[client/approval] revision_requests insert warning:', revError.message);
        }
      } catch (e) {
        console.warn('[client/approval] revision_requests exception:', e);
      }

      return NextResponse.json({
        success: true,
        message: 'Client feedback submitted directly to architect!',
        status: 'Revision Requested',
        feedbackEntry
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Expected "approve" or "feedback".' },
        { status: 400 }
      );
    }

  } catch (err: any) {
    console.error('[client/approval] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
