import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((request) => {
  const token = localStorage.getItem("token");

  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }

  return request;
});

export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiClient.get<T>(url);
  return response.data;
}

export async function apiPost<TRequest, TResponse>(
  url: string,
  data: TRequest
): Promise<TResponse> {
  const response = await apiClient.post<TResponse>(url, data);
  return response.data;
}

export async function apiPut<TRequest, TResponse>(
  url: string,
  data: TRequest
): Promise<TResponse> {
  const response = await apiClient.put<TResponse>(url, data);
  return response.data;
}

export async function apiDelete<TResponse>(url: string): Promise<TResponse> {
  const response = await apiClient.delete<TResponse>(url);
  return response.data;
}

export const apiFetch = apiGet;