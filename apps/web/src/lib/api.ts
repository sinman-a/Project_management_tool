const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit & { skipContentType?: boolean }): Promise<T> {
  const { skipContentType, ...fetchOptions } = options ?? {}
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: skipContentType
      ? { ...(fetchOptions.headers ?? {}) }
      : { 'Content-Type': 'application/json', ...(fetchOptions.headers ?? {}) },
    credentials: 'include',
    ...fetchOptions,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }))
    throw new ApiError(response.status, body.message ?? 'Request failed')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: 'POST',
      body: formData,
      skipContentType: true,
    }),
}

export { ApiError }
