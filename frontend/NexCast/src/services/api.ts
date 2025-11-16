import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL;

/**
 * Create axios instance for API calls
 */
const createApiClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return instance;
};

// Create the default API client
export const apiClient = createApiClient();

/**
 * Set authorization token for API requests
 * Call this after user authentication
 */
export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Session preferences interface
export interface SessionPreferences {
  voice?: string;
  commentary_style?: string;
  speaking_rate?: number;
  pitch?: number;
  volume?: number;
}

export interface Session {
  session_id: number;
  started_at: string;
  ended_at?: string;
  duration?: number;
  status: string;
  frame_count: number;
  preferences: SessionPreferences;
  commentary_count?: number;
}

export interface Commentary {
  id: number;
  commentator_model: string;
  scene_description: string;
  commentary_text: string;
  audio_url: string;
  created_at: string;
}

export interface SessionDetail extends Session {
  commentaries: Commentary[];
}

/**
 * API Service Methods
 */
export const api = {
  /**
   * Start a new session with preferences
   */
  async startSession(preferences?: SessionPreferences): Promise<{
    session_id: number;
    status: string;
    preferences: SessionPreferences;
  }> {
    const response = await apiClient.post('/session/start', {
      preferences: preferences || {},
    });
    return response.data;
  },

  /**
   * End an active session
   */
  async endSession(
    sessionId: number,
    frameCount: number = 0
  ): Promise<{
    session_id: number;
    status: string;
    frame_count: number;
  }> {
    const response = await apiClient.post('/session/end', {
      session_id: sessionId,
      frame_count: frameCount,
    });
    return response.data;
  },

  /**
   * Get list of all sessions for current user
   */
  async getHistory(): Promise<{ sessions: Session[] }> {
    const response = await apiClient.get('/history/list');
    return response.data;
  },

  /**
   * Get detailed information about a specific session
   */
  async getSessionDetails(sessionId: number): Promise<SessionDetail> {
    const response = await apiClient.get(`/history/${sessionId}`);
    return response.data;
  },

  /**
   * Health check
   */
  async health(): Promise<{ status: string }> {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

export default api;
