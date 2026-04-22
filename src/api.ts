export type Role = 'tenant' | 'landlord';

export interface User {
  id: number;
  name: string;
  phone: string;
  role: Role;
}

export interface Property {
  id: number;
  landlord_id: number;
  landlord_name: string;
  title: string;
  district: string;
  price: number;
  area: number;
  description: string;
  image_url: string;
}

export interface Message {
  id: number;
  property_id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  property_title?: string;
  sender_name?: string;
}

const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? 'Request failed.');
  }
  return res.json() as Promise<T>;
}

export function register(payload: {
  name: string;
  phone: string;
  password: string;
  role: Role;
}) {
  return request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function login(payload: { phone: string; password: string }) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function listProperties(filters: { district?: string; max_price?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.district) params.set('district', filters.district);
  if (filters.max_price) params.set('max_price', String(filters.max_price));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<Property[]>(`/properties${query}`);
}

export function createProperty(
  token: string,
  payload: {
    title: string;
    district: string;
    price: number;
    area: number;
    description: string;
    image_url: string;
  }
) {
  return request<Property>('/properties', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

export function sendMessage(
  token: string,
  payload: { property_id: number; receiver_id: number; content: string }
) {
  return request<Message>('/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

export function getInbox(token: string) {
  return request<Message[]>('/messages/inbox', {
    headers: { Authorization: `Bearer ${token}` }
  });
}
