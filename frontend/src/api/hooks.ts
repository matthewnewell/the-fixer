import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Action, ActionKind, ActionStatus, ChatMessage, ChatResponse, Incident, WhyStep } from './types'

export function useIncidents(filters?: { project?: string; status?: string }) {
  const params = new URLSearchParams()
  if (filters?.project) params.set('project', filters.project)
  if (filters?.status) params.set('status', filters.status)
  const qs = params.toString()
  return useQuery({
    queryKey: ['incidents', filters?.project ?? null, filters?.status ?? null],
    queryFn: () => api.get<Incident[]>(`/incidents${qs ? `?${qs}` : ''}`),
  })
}

export function useIncident(incidentId: string | undefined) {
  return useQuery({
    queryKey: ['incidents', 'detail', incidentId],
    queryFn: () => api.get<Incident>(`/incidents/${incidentId}`),
    enabled: !!incidentId,
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<string[]>('/projects'),
  })
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string; ai_configured: boolean }>('/health'),
  })
}

function useInvalidateIncident(incidentId?: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['incidents'] })
    if (incidentId) qc.invalidateQueries({ queryKey: ['incidents', 'detail', incidentId] })
  }
}

export function useCreateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; description?: string; project?: string; reported_by?: string }) =>
      api.post<Incident>('/incidents', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateIncident(incidentId: string) {
  const invalidate = useInvalidateIncident(incidentId)
  return useMutation({
    mutationFn: (data: Partial<Pick<Incident, 'title' | 'description' | 'project' | 'reported_by' | 'status'>>) =>
      api.put<Incident>(`/incidents/${incidentId}`, data),
    onSuccess: invalidate,
  })
}

export function useAddWhyStep(incidentId: string) {
  const invalidate = useInvalidateIncident(incidentId)
  return useMutation({
    mutationFn: (data: { question?: string; answer?: string; created_by?: string }) =>
      api.post<WhyStep>(`/incidents/${incidentId}/why-steps`, data),
    onSuccess: invalidate,
  })
}

export function useUpdateWhyStep(incidentId: string) {
  const invalidate = useInvalidateIncident(incidentId)
  return useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: Partial<Pick<WhyStep, 'question' | 'answer' | 'is_root_cause'>> }) =>
      api.put<WhyStep>(`/why-steps/${stepId}`, data),
    onSuccess: invalidate,
  })
}

export function useDeleteWhyStep(incidentId: string) {
  const invalidate = useInvalidateIncident(incidentId)
  return useMutation({
    mutationFn: (stepId: string) => api.del(`/why-steps/${stepId}`),
    onSuccess: invalidate,
  })
}

export function useCreateAction(incidentId: string) {
  const invalidate = useInvalidateIncident(incidentId)
  return useMutation({
    mutationFn: (data: { kind: ActionKind; description: string; owner?: string; due_date?: string }) =>
      api.post<Action>(`/incidents/${incidentId}/actions`, data),
    onSuccess: invalidate,
  })
}

export function useUpdateAction(incidentId: string) {
  const invalidate = useInvalidateIncident(incidentId)
  return useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: { status?: ActionStatus; verified_by?: string; owner?: string; due_date?: string } }) =>
      api.put<Action>(`/actions/${actionId}`, data),
    onSuccess: invalidate,
  })
}

export function useChat() {
  return useMutation({
    mutationFn: (data: { messages: ChatMessage[]; incidentId: string }) =>
      api.post<ChatResponse>('/chat', { messages: data.messages, incident_id: data.incidentId }),
  })
}
