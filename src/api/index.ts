import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import { post } from '@/utils/request'
import { useAuthStore, useChatStore, useSettingStore } from '@/store'

export function fetchChatAPI<T = any>(
  prompt: string,
  options?: { conversationId?: string; parentMessageId?: string },
  signal?: GenericAbortSignal,
) {
  return post<T>({
    url: '/api/chat',
    data: { prompt, options },
    signal,
  })
}

export function fetchChatConfig<T = any>() {
  return post<T>({
    url: '/api/config',
  })
}

export function fetchChatAPIProcess<T = any>(
  params: {
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const settingStore = useSettingStore()
  const authStore = useAuthStore()

  let data: Record<string, any> = {
    prompt: params.prompt,
    options: params.options,
  }

  if (authStore.isChatGPTAPI) {
    data = {
      ...data,
      systemMessage: settingStore.systemMessage,
      temperature: settingStore.temperature,
      top_p: settingStore.top_p,
    }
  }

  return post<T>({
    url: '/api/chat-process',
    data,
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export function fetchChatAPIProcess2<T = any>(
  params: {
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const data: Record<string, any> = {
    query: params.prompt,
    mode: 'local_kb',
    kb_name: 'samples',
    top_k: 3,
    score_threshold: 2,
    history: [],
    stream: false,
    model: 'deepseek-r1-qwen14b',
    temperature: 0.7,
    max_tokens: 0,
    prompt_name: 'default',
    return_direct: false,
  }
  return post<T>({
    url: '/chat/kb_chat',
    data,
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export function fetchChatAPIProcess3<T = any>(
  params: {
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const chatStore = useChatStore()
  const knowledge_id = chatStore.getChatHistoryByCurrentActive?.knowledge_id
  const data: Record<string, any> = {
    knowledge_id,
    top_k: 3,
    model_name: 'deepseek-r1-qwen14b',
    query: params.prompt,
    history: [],
    max_tokens: 0,
    temperature: 0.7,
    score_threshold: 2,
    stream: false,
    prompt_name: 'default',
  }
  return post<T>({
    url: '/chat/file_chat',
    data,
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export function fetchSession<T>() {
  return post<T>({
    url: '/api/session',
  })
}

export function fetchVerify<T>(token: string) {
  return post<T>({
    url: '/api/verify',
    data: { token },
  })
}
