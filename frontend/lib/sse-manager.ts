import { API_BASE } from "@/lib/constants"

type SSEListener = (event: MessageEvent) => void

let eventSource: EventSource | null = null
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let listeners: Set<SSEListener> = new Set()
let isConnected = false
let connectionListeners: Set<(connected: boolean) => void> = new Set()

function connect() {
  if (eventSource?.readyState === EventSource.OPEN) return

  if (eventSource) {
    eventSource.close()
    eventSource = null
  }

  eventSource = new EventSource(`${API_BASE}/api/stream`)

  eventSource.onopen = () => {
    isConnected = true
    connectionListeners.forEach((l) => l(true))
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  eventSource.onerror = () => {
    isConnected = false
    connectionListeners.forEach((l) => l(false))
    eventSource?.close()
    eventSource = null
    if (!reconnectTimeout) {
      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null
        connect()
      }, 2000)
    }
  }

  eventSource.onmessage = (e: MessageEvent) => {
    listeners.forEach((l) => l(e))
  }
}

export const sseManager = {
  connect,

  addListener(listener: SSEListener) {
    listeners.add(listener)
  },

  removeListener(listener: SSEListener) {
    listeners.delete(listener)
  },

  addConnectionListener(listener: (connected: boolean) => void) {
    connectionListeners.add(listener)
    listener(isConnected)
  },

  removeConnectionListener(listener: (connected: boolean) => void) {
    connectionListeners.delete(listener)
  },

  getIsConnected() {
    return isConnected
  },
}

if (typeof window !== "undefined") {
  connect()
}
