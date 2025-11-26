import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { SessionPreferences } from '../interfaces/session';
import type { Voice } from '../interfaces/voice';

const INTERVAL_OPTIONS = [
  { value: 10000, label: '10s (Fast)' },
  { value: 20000, label: '20s (Balanced)' },
  { value: 30000, label: '30s (Slow)' },
];

const DEFAULT_VOICES: Voice[] = [
  {
    voice_id: 'qVpGLzi5EhjW3WGVhOa9',
    name: 'American Urban',
  },
  {
    voice_id: 'gU0LNdkMOQCOrPrwtbee',
    name: 'British Football Announcer',
  },
];

interface PreferencesPanelProps {
  preferences: SessionPreferences;
  isSessionActive: boolean;
  onPreferencesChange: (preferences: SessionPreferences) => void;
}

export const PreferencesPanel = ({
  preferences,
  isSessionActive,
  onPreferencesChange,
}: PreferencesPanelProps) => {
  const [voices, setVoices] = useState<Voice[]>(DEFAULT_VOICES);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

        if (!apiKey) {
          console.warn('VITE_ELEVENLABS_API_KEY not configured, using default voices');
          setIsLoadingVoices(false);
          return;
        }

        const response = await fetch('https://api.elevenlabs.io/v2/voices', {
          headers: {
            'xi-api-key': apiKey,
          },
        });

        if (!response.ok) {
          console.error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
          if (response.status === 401) {
            console.error('API key is invalid or expired. Check VITE_ELEVENLABS_API_KEY in .env file');
          }
          setIsLoadingVoices(false);
          return;
        }

        const data = await response.json();
        if (data.voices && data.voices.length > 0) {
          setVoices(data.voices);
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
      } finally {
        setIsLoadingVoices(false);
      }
    };

    fetchVoices();
  }, []);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-white">Preferences</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="speaker1" className="text-sm font-medium text-gray-300">
              Speaker 1
            </label>
            <select
              id="speaker1"
              value={preferences.speaker1_voice_id || ''}
              onChange={(e) =>
                onPreferencesChange({ ...preferences, speaker1_voice_id: e.target.value })
              }
              disabled={isSessionActive || isLoadingVoices}
              className="flex h-9 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a voice...</option>
              {voices.map((voice) => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="speaker2" className="text-sm font-medium text-gray-300">
              Speaker 2 <span className="text-gray-500">(Optional)</span>
            </label>
            <select
              id="speaker2"
              value={preferences.speaker2_voice_id || ''}
              onChange={(e) =>
                onPreferencesChange({
                  ...preferences,
                  speaker2_voice_id: e.target.value || undefined,
                })
              }
              disabled={isSessionActive || isLoadingVoices}
              className="flex h-9 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">None (single speaker)</option>
              {voices.map((voice) => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="interval" className="text-sm font-medium text-gray-300">
              Capture Interval
            </label>
            <select
              id="interval"
              value={preferences.capture_interval}
              onChange={(e) =>
                onPreferencesChange({
                  ...preferences,
                  capture_interval: parseInt(e.target.value),
                })
              }
              disabled={isSessionActive}
              className="flex h-9 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isSessionActive && (
          <div className="rounded-lg bg-gray-700/50 border border-gray-600 p-3 text-sm text-gray-400">
            Preferences are locked during active session
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PreferencesPanel;
