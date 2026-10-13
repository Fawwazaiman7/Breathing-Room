import { request } from '../lib/api';
import type { AdviseeDetail, AdvisorDashboard } from './types';

export function fetchAdvisorDashboard(): Promise<AdvisorDashboard> {
  return request<AdvisorDashboard>('/advisor/students');
}

export function fetchAdvisee(studentId: string): Promise<AdviseeDetail> {
  return request<AdviseeDetail>(`/advisor/students/${studentId}`);
}
