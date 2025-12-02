import { supabase } from './supabase'

export interface TeamInvitation {
  id: string
  coach_id: string
  athlete_email: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  created_at: string
  expires_at: string
  accepted_at?: string
  coach_name?: string
}

// Type for database rows
interface TeamInvitationRow {
  id: string
  coach_id: string
  athlete_email: string
  status: string
  created_at: string
  expires_at: string
  accepted_at?: string
  profiles?: { full_name?: string }
}

interface CoachAthleteRow {
  coach_id: string
  athlete_id: string
}

export async function sendTeamInvitation(athleteEmail: string, coachId: string, coachName: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if invitation already exists
    const { data: existingInvite } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('coach_id', coachId)
      .eq('athlete_email', athleteEmail)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return { success: false, error: 'An invitation has already been sent to this email' }
    }

    // Create new invitation
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    const { data, error } = await supabase
      .from('team_invitations')
      .insert({
        coach_id: coachId,
        athlete_email: athleteEmail.toLowerCase(),
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      } as unknown as never)
      .select()
      .single()

    if (error) throw error

    const invitationData = data as unknown as TeamInvitationRow

    // Send invitation email via Edge Function or backend API
    // For now, we'll call a Supabase Edge Function
    const { error: emailError } = await supabase.functions.invoke('send-team-invitation', {
      body: {
        invitationId: invitationData.id,
        athleteEmail: athleteEmail,
        coachName: coachName,
        acceptUrl: `${window.location.origin}/accept-invitation/${invitationData.id}`,
      },
    })

    if (emailError) {
      console.error('Failed to send email:', emailError)
      // Still return success since invitation was created
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to send invitation:', error)
    return { success: false, error: 'Failed to send invitation. Please try again.' }
  }
}

export async function getPendingInvitations(coachId: string): Promise<TeamInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch invitations:', error)
    return []
  }
}

export async function cancelInvitation(invitationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', invitationId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Failed to cancel invitation:', error)
    return false
  }
}

export async function resendInvitation(invitationId: string, coachName: string): Promise<boolean> {
  try {
    // Update expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
      .from('team_invitations')
      .update({ expires_at: expiresAt.toISOString() } as unknown as never)
      .eq('id', invitationId)
      .select()
      .single()

    if (error) throw error

    const invitationData = data as unknown as TeamInvitationRow

    // Resend email
    await supabase.functions.invoke('send-team-invitation', {
      body: {
        invitationId: invitationData.id,
        athleteEmail: invitationData.athlete_email,
        coachName: coachName,
        acceptUrl: `${window.location.origin}/accept-invitation/${invitationData.id}`,
      },
    })

    return true
  } catch (error) {
    console.error('Failed to resend invitation:', error)
    return false
  }
}

export async function getInvitationDetails(invitationId: string): Promise<TeamInvitation | null> {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select(`
        *,
        profiles:coach_id (full_name)
      `)
      .eq('id', invitationId)
      .single()

    if (error) throw error
    
    const invitationData = data as unknown as TeamInvitationRow
    return {
      id: invitationData.id,
      coach_id: invitationData.coach_id,
      athlete_email: invitationData.athlete_email,
      status: invitationData.status as TeamInvitation['status'],
      created_at: invitationData.created_at,
      expires_at: invitationData.expires_at,
      accepted_at: invitationData.accepted_at,
      coach_name: invitationData.profiles?.full_name,
    }
  } catch (error) {
    console.error('Failed to fetch invitation:', error)
    return null
  }
}

export async function acceptInvitation(invitationId: string, athleteId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get invitation details
    const { data: invitation, error: fetchError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', invitationId)
      .single()

    if (fetchError || !invitation) {
      return { success: false, error: 'Invitation not found' }
    }

    const invitationData = invitation as unknown as TeamInvitationRow

    if (invitationData.status !== 'pending') {
      return { success: false, error: 'This invitation has already been used or expired' }
    }

    if (new Date(invitationData.expires_at) < new Date()) {
      return { success: false, error: 'This invitation has expired' }
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      } as unknown as never)
      .eq('id', invitationId)

    if (updateError) throw updateError

    // Add athlete to coach's team
    const { error: teamError } = await supabase
      .from('coach_athletes')
      .insert({
        coach_id: invitationData.coach_id,
        athlete_id: athleteId,
      } as unknown as never)

    if (teamError) throw teamError

    return { success: true }
  } catch (error) {
    console.error('Failed to accept invitation:', error)
    return { success: false, error: 'Failed to accept invitation. Please try again.' }
  }
}

export async function declineInvitation(invitationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('team_invitations')
      .update({ status: 'declined' } as unknown as never)
      .eq('id', invitationId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Failed to decline invitation:', error)
    return false
  }
}

// Export the row type for use in other files if needed
export type { TeamInvitationRow, CoachAthleteRow }

